import { NextRequest, NextResponse } from "next/server";
import { generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { z } from "zod";
import { nanoid } from "nanoid";
import { getModelById } from "@/lib/models";
import { buildSinglePrompt, buildPairwisePrompt } from "@/lib/prompts";
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
  SingleEvalResult,
  PairwiseEvalResult,
  CriterionScore,
  PairwiseVerdict,
} from "@/lib/types";

const RequestSchema = z.object({
  mode: z.enum(["single", "pairwise"]),
  prompt: z.string().min(1),
  response: z.string().optional(),
  responseA: z.string().optional(),
  responseB: z.string().optional(),
  rubricId: z.string().min(1),
  rubric: RubricSchema.optional(),
  modelId: ModelIdSchema,
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
      mode,
      prompt,
      response,
      responseA,
      responseB,
      modelId,
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

    if (mode === "single") {
      if (!response) {
        return NextResponse.json(
          { error: "response is required for single mode" },
          { status: 400 }
        );
      }

      const input = { prompt, response, rubricId: rubric.id, modelId, context };
      const judgePrompt = buildSinglePrompt(input, rubric);
      const { text, usage } = await generateText({
        model: getModel(modelId, provider, apiKey),
        prompt: judgePrompt,
        temperature: 0.1,
        maxOutputTokens: 4096,
      });

      const parsedJson = parseJudgeJson(text);

      const criterionScores: CriterionScore[] = rubric.criteria.map((c) => ({
        criterionId: c.id,
        criterionName: c.name,
        score: normalizeCriterionScore(
          (parsedJson.scores as Record<string, unknown>)?.[c.id],
          c.scoreRange
        ),
        maxScore: c.scoreRange,
        reasoning: normalizeText(
          (parsedJson.criterion_reasoning as Record<string, unknown>)?.[
            `${c.id}_reasoning`
          ]
        ),
      }));

      const aggregateScore = normalizeAggregateScore(
        parsedJson.aggregate_score,
        computeAggregate(criterionScores, rubric)
      );

      const inputTokens = usage.inputTokens ?? 0;
      const outputTokens = usage.outputTokens ?? 0;

      const result: SingleEvalResult = {
        id: nanoid(),
        mode: "single",
        createdAt: new Date().toISOString(),
        input,
        rubric,
        judgeModel,
        chainOfThought: normalizeText(parsedJson.chain_of_thought),
        summary: normalizeText(parsedJson.summary),
        criterionScores,
        aggregateScore,
        inputTokens,
        outputTokens,
        estimatedCostUsd:
          (inputTokens / 1_000_000) * judgeModel.inputCostPer1M +
          (outputTokens / 1_000_000) * judgeModel.outputCostPer1M,
      };

      return NextResponse.json(result);
    }

    // pairwise
    if (!responseA || !responseB) {
      return NextResponse.json(
        { error: "responseA and responseB are required for pairwise mode" },
        { status: 400 }
      );
    }

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

    const judgePrompt = buildPairwisePrompt(input, rubric, "AB");
    const { text, usage } = await generateText({
      model: getModel(modelId, provider, apiKey),
      prompt: judgePrompt,
      temperature: 0.1,
      maxOutputTokens: 4096,
    });

    const parsedJson = parseJudgeJson(text);

    const criterionScoresA: CriterionScore[] = rubric.criteria.map((c) => ({
      criterionId: c.id,
      criterionName: c.name,
      score: normalizeCriterionScore(
        (parsedJson.scores as Record<string, unknown>)?.[`${c.id}_A`],
        c.scoreRange
      ),
      maxScore: c.scoreRange,
      reasoning: normalizeText(
        (parsedJson.criterion_reasoning as Record<string, unknown>)?.[
          `${c.id}_A_reasoning`
        ]
      ),
    }));

    const criterionScoresB: CriterionScore[] = rubric.criteria.map((c) => ({
      criterionId: c.id,
      criterionName: c.name,
      score: normalizeCriterionScore(
        (parsedJson.scores as Record<string, unknown>)?.[`${c.id}_B`],
        c.scoreRange
      ),
      maxScore: c.scoreRange,
      reasoning: normalizeText(
        (parsedJson.criterion_reasoning as Record<string, unknown>)?.[
          `${c.id}_B_reasoning`
        ]
      ),
    }));

    const rawVerdict = normalizeVerdict(parsedJson.verdict);
    const verdict: PairwiseVerdict =
      rawVerdict === "A" ? "A" : rawVerdict === "B" ? "B" : "tie";

    const inputTokens = usage.inputTokens ?? 0;
    const outputTokens = usage.outputTokens ?? 0;

    const result: PairwiseEvalResult = {
      id: nanoid(),
      mode: "pairwise",
      createdAt: new Date().toISOString(),
      input,
      rubric,
      judgeModel,
      chainOfThought: normalizeText(parsedJson.chain_of_thought),
      summary: normalizeText(parsedJson.summary) || normalizeText(parsedJson.verdict_reasoning),
      criterionScoresA,
      criterionScoresB,
      aggregateScoreA: normalizeAggregateScore(
        parsedJson.aggregate_score_A,
        computeAggregate(criterionScoresA, rubric)
      ),
      aggregateScoreB: normalizeAggregateScore(
        parsedJson.aggregate_score_B,
        computeAggregate(criterionScoresB, rubric)
      ),
      verdict,
      verdictReasoning: normalizeText(parsedJson.verdict_reasoning),
      inputTokens,
      outputTokens,
      estimatedCostUsd:
        (inputTokens / 1_000_000) * judgeModel.inputCostPer1M +
        (outputTokens / 1_000_000) * judgeModel.outputCostPer1M,
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
