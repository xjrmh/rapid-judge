import { NextRequest, NextResponse } from "next/server";
import { generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { z } from "zod";
import { nanoid } from "nanoid";
import { getModelById } from "@/lib/models";
import { buildPairwisePrompt } from "@/lib/prompts";
import { getBuiltInRubricById } from "@/lib/rubric-templates";
import { ModelIdSchema, RubricSchema } from "@/lib/eval-validation";
import {
  JudgeJsonParseError,
  normalizeAggregateScore,
  normalizeCriterionScore,
  normalizeText,
  normalizeVerdict,
  parseJudgeJson,
} from "@/lib/judge-output";
import type {
  Provider,
  Rubric,
  PairwiseEvalResult,
  CriterionScore,
  PairwiseVerdict,
} from "@/lib/types";

const RequestSchema = z.object({
  prompt: z.string().min(1),
  responseA: z.string().min(1),
  responseB: z.string().min(1),
  modelLabelA: z.string().optional(),
  modelLabelB: z.string().optional(),
  rubricId: z.string().min(1),
  rubric: RubricSchema.optional(),
  modelId: ModelIdSchema,
  doubleBlind: z.boolean().default(true),
  detectPositionBias: z.boolean().default(false),
  context: z.string().optional(),
});

function getModel(modelId: string, provider: Provider, apiKey: string) {
  if (provider === "openai") {
    return createOpenAI({ apiKey })(modelId);
  }
  if (provider === "anthropic") {
    return createAnthropic({ apiKey })(modelId);
  }
  return createGoogleGenerativeAI({ apiKey })(modelId);
}

function extractPairwiseScores(
  parsed: Record<string, unknown>,
  rubric: Rubric,
  side: "A" | "B"
): CriterionScore[] {
  return rubric.criteria.map((c) => ({
    criterionId: c.id,
    criterionName: c.name,
    score: normalizeCriterionScore(
      (parsed.scores as Record<string, unknown>)?.[`${c.id}_${side}`],
      c.scoreRange
    ),
    maxScore: c.scoreRange,
    reasoning: normalizeText(
      (parsed.criterion_reasoning as Record<string, unknown>)?.[
        `${c.id}_${side}_reasoning`
      ]
    ),
  }));
}

function computeAggregate(scores: CriterionScore[], rubric: Rubric): number {
  let weighted = 0;
  let totalWeight = 0;
  for (const cs of scores) {
    const criterion = rubric.criteria.find((c) => c.id === cs.criterionId);
    if (!criterion) continue;
    const clampedScore = Math.max(1, Math.min(cs.maxScore, cs.score));
    weighted += (clampedScore / cs.maxScore) * 100 * criterion.weight;
    totalWeight += criterion.weight;
  }
  if (totalWeight === 0) return 0;
  const score = weighted / totalWeight;
  return Math.round(Math.max(0, Math.min(100, score)) * 10) / 10;
}

async function runPairwiseEval(
  prompt: string,
  responseA: string,
  responseB: string,
  rubric: Rubric,
  modelId: string,
  provider: Provider,
  apiKey: string,
  context: string | undefined,
  order: "AB" | "BA",
  doubleBlind: boolean,
  modelLabelA?: string,
  modelLabelB?: string
) {
  const input = {
    prompt,
    responseA,
    responseB,
    rubricId: rubric.id,
    modelId,
    doubleBlind,
    detectPositionBias: false,
    modelLabelA,
    modelLabelB,
    context,
  };

  const judgePrompt = buildPairwisePrompt(input, rubric, order);

  const { text, usage } = await generateText({
    model: getModel(modelId, provider, apiKey),
    prompt: judgePrompt,
    temperature: 0.1,
    maxOutputTokens: 4096,
  });

  const parsed = parseJudgeJson(text);

  // When order is BA, swap A/B labels back to canonical A/B
  const scoresA =
    order === "AB"
      ? extractPairwiseScores(parsed, rubric, "A")
      : extractPairwiseScores(parsed, rubric, "B");
  const scoresB =
    order === "AB"
      ? extractPairwiseScores(parsed, rubric, "B")
      : extractPairwiseScores(parsed, rubric, "A");

  const rawVerdict = normalizeVerdict(parsed.verdict);
  const verdict: PairwiseVerdict =
    order === "AB"
      ? rawVerdict
      : rawVerdict === "A"
        ? "B"
        : rawVerdict === "B"
          ? "A"
          : "tie";

  return {
    chainOfThought: normalizeText(parsed.chain_of_thought),
    summary: normalizeText(parsed.summary),
    scoresA,
    scoresB,
    aggregateA: normalizeAggregateScore(
      parsed.aggregate_score_A,
      computeAggregate(scoresA, rubric)
    ),
    aggregateB: normalizeAggregateScore(
      parsed.aggregate_score_B,
      computeAggregate(scoresB, rubric)
    ),
    verdict,
    verdictReasoning: normalizeText(parsed.verdict_reasoning),
    usage,
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = RequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const {
      prompt,
      responseA,
      responseB,
      modelLabelA,
      modelLabelB,
      modelId,
      doubleBlind,
      detectPositionBias,
      context,
      rubric: rubricSnapshot,
      rubricId,
    } = parsed.data;

    const rubric: Rubric | undefined =
      rubricSnapshot ?? getBuiltInRubricById(rubricId);
    if (!rubric) {
      return NextResponse.json({ error: "Rubric not found" }, { status: 400 });
    }

    const judgeModel = getModelById(modelId);
    if (!judgeModel) {
      return NextResponse.json({ error: "Unknown model" }, { status: 400 });
    }

    const provider = judgeModel.provider;
    const apiKey =
      req.headers.get(`x-${provider}-api-key`) ||
      (provider === "openai"
        ? process.env.OPENAI_API_KEY
        : provider === "anthropic"
          ? process.env.ANTHROPIC_API_KEY
          : process.env.GOOGLE_API_KEY) ||
      "";

    if (!apiKey) {
      return NextResponse.json(
        { error: `No API key found for provider: ${provider}` },
        { status: 401 }
      );
    }

    // Primary evaluation (AB order)
    const primary = await runPairwiseEval(
      prompt,
      responseA,
      responseB,
      rubric,
      modelId,
      provider,
      apiKey,
      context,
      "AB",
      doubleBlind,
      modelLabelA,
      modelLabelB
    );

    let totalInputTokens = primary.usage.inputTokens ?? 0;
    let totalOutputTokens = primary.usage.outputTokens ?? 0;
    let reversedVerdict: PairwiseVerdict | undefined;
    let reversedChainOfThought: string | undefined;
    let positionBiasDetected: boolean | undefined;

    if (detectPositionBias) {
      const reversed = await runPairwiseEval(
        prompt,
        responseA,
        responseB,
        rubric,
        modelId,
        provider,
        apiKey,
        context,
        "BA",
        doubleBlind,
        modelLabelA,
        modelLabelB
      );
      totalInputTokens += reversed.usage.inputTokens ?? 0;
      totalOutputTokens += reversed.usage.outputTokens ?? 0;
      reversedVerdict = reversed.verdict;
      reversedChainOfThought = reversed.chainOfThought;
      positionBiasDetected = primary.verdict !== reversed.verdict;
    }

    const estimatedCostUsd =
      (totalInputTokens / 1_000_000) * judgeModel.inputCostPer1M +
      (totalOutputTokens / 1_000_000) * judgeModel.outputCostPer1M;

    const result: PairwiseEvalResult = {
      id: nanoid(),
      mode: "pairwise",
      createdAt: new Date().toISOString(),
      input: {
        prompt,
        responseA,
        responseB,
        modelLabelA,
        modelLabelB,
        rubricId: rubric.id,
        modelId,
        doubleBlind,
        detectPositionBias,
        context,
      },
      rubric,
      judgeModel,
      chainOfThought: primary.chainOfThought,
      summary: primary.summary || primary.verdictReasoning,
      criterionScoresA: primary.scoresA,
      criterionScoresB: primary.scoresB,
      aggregateScoreA: primary.aggregateA,
      aggregateScoreB: primary.aggregateB,
      verdict: primary.verdict,
      verdictReasoning: primary.verdictReasoning,
      reversedVerdict,
      reversedChainOfThought,
      positionBiasDetected,
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
      estimatedCostUsd,
    };

    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof JudgeJsonParseError) {
      return NextResponse.json(
        { error: "Judge returned invalid JSON", raw: err.raw },
        { status: 502 }
      );
    }

    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
