import { NextRequest, NextResponse } from "next/server";
import { generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { z } from "zod";
import { nanoid } from "nanoid";
import { resolveProvider, getModelById } from "@/lib/models";
import { buildPairwisePrompt } from "@/lib/prompts";
import { getBuiltInRubricById } from "@/lib/rubric-templates";
import type {
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
  rubricId: z.string(),
  rubric: z.any(),
  modelId: z.string(),
  doubleBlind: z.boolean().default(true),
  detectPositionBias: z.boolean().default(false),
  context: z.string().optional(),
});

function getModel(modelId: string, apiKey: string) {
  const provider = resolveProvider(modelId);
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
    score:
      Number(
        (parsed.scores as Record<string, unknown>)?.[`${c.id}_${side}`]
      ) || 0,
    maxScore: c.scoreRange,
    reasoning: String(
      (parsed.criterion_reasoning as Record<string, unknown>)?.[
        `${c.id}_${side}_reasoning`
      ] ?? ""
    ),
  }));
}

function computeAggregate(scores: CriterionScore[], rubric: Rubric): number {
  let weighted = 0;
  let totalWeight = 0;
  for (const cs of scores) {
    const criterion = rubric.criteria.find((c) => c.id === cs.criterionId);
    if (!criterion) continue;
    weighted += (cs.score / cs.maxScore) * 100 * criterion.weight;
    totalWeight += criterion.weight;
  }
  if (totalWeight === 0) return 0;
  return Math.round((weighted / totalWeight) * 10) / 10;
}

async function runPairwiseEval(
  prompt: string,
  responseA: string,
  responseB: string,
  rubric: Rubric,
  modelId: string,
  apiKey: string,
  context: string | undefined,
  order: "AB" | "BA"
) {
  const input = {
    prompt,
    responseA,
    responseB,
    rubricId: rubric.id,
    modelId,
    doubleBlind: true,
    detectPositionBias: false,
    context,
  };

  const judgePrompt = buildPairwisePrompt(input, rubric, order);

  const { text, usage } = await generateText({
    model: getModel(modelId, apiKey),
    prompt: judgePrompt,
    temperature: 0.1,
    maxOutputTokens: 4096,
  });

  const cleaned = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/, "")
    .trim();
  const parsed = JSON.parse(cleaned) as Record<string, unknown>;

  // When order is BA, swap A/B labels back to canonical A/B
  const scoresA =
    order === "AB"
      ? extractPairwiseScores(parsed, rubric, "A")
      : extractPairwiseScores(parsed, rubric, "B");
  const scoresB =
    order === "AB"
      ? extractPairwiseScores(parsed, rubric, "B")
      : extractPairwiseScores(parsed, rubric, "A");

  const rawVerdict = String(parsed.verdict ?? "tie").toLowerCase();
  let verdict: PairwiseVerdict;
  if (rawVerdict === "a") {
    verdict = order === "AB" ? "A" : "B";
  } else if (rawVerdict === "b") {
    verdict = order === "AB" ? "B" : "A";
  } else {
    verdict = "tie";
  }

  return {
    chainOfThought: String(parsed.chain_of_thought ?? ""),
    scoresA,
    scoresB,
    aggregateA: Number(parsed.aggregate_score_A) || computeAggregate(scoresA, rubric),
    aggregateB: Number(parsed.aggregate_score_B) || computeAggregate(scoresB, rubric),
    verdict,
    verdictReasoning: String(parsed.verdict_reasoning ?? ""),
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
    } = parsed.data;

    const rubric: Rubric =
      rubricSnapshot ?? getBuiltInRubricById(parsed.data.rubricId);
    if (!rubric) {
      return NextResponse.json({ error: "Rubric not found" }, { status: 400 });
    }

    const provider = resolveProvider(modelId);
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

    const judgeModel = getModelById(modelId);
    if (!judgeModel) {
      return NextResponse.json({ error: "Unknown model" }, { status: 400 });
    }

    // Primary evaluation (AB order)
    const primary = await runPairwiseEval(
      prompt,
      responseA,
      responseB,
      rubric,
      modelId,
      apiKey,
      context,
      "AB"
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
        apiKey,
        context,
        "BA"
      );
      totalInputTokens += reversed.usage.inputTokens ?? 0;
      totalOutputTokens += reversed.usage.outputTokens ?? 0;
      reversedVerdict = reversed.verdict;
      reversedChainOfThought = reversed.chainOfThought;
      // Bias detected if verdicts differ (excluding tie in both)
      positionBiasDetected =
        primary.verdict !== "tie" &&
        reversed.verdict !== "tie" &&
        primary.verdict !== reversed.verdict;
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
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
