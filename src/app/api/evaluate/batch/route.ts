import { NextRequest, NextResponse } from "next/server";
import { generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { z } from "zod";
import { nanoid } from "nanoid";
import { resolveProvider, getModelById } from "@/lib/models";
import { buildSinglePrompt, buildPairwisePrompt } from "@/lib/prompts";
import { getBuiltInRubricById } from "@/lib/rubric-templates";
import type {
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
  rubricId: z.string(),
  rubric: z.any(),
  modelId: z.string(),
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

    const { mode, prompt, response, responseA, responseB, modelId, context, rubric: rubricSnapshot } =
      parsed.data;

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
        model: getModel(modelId, apiKey),
        prompt: judgePrompt,
        temperature: 0.1,
        maxOutputTokens: 4096,
      });

      const cleaned = text
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```\s*$/, "")
        .trim();
      const parsedJson = JSON.parse(cleaned) as Record<string, unknown>;

      const criterionScores: CriterionScore[] = rubric.criteria.map((c) => ({
        criterionId: c.id,
        criterionName: c.name,
        score: Number((parsedJson.scores as Record<string, unknown>)?.[c.id]) || 0,
        maxScore: c.scoreRange,
        reasoning: String(
          (parsedJson.criterion_reasoning as Record<string, unknown>)?.[
            `${c.id}_reasoning`
          ] ?? ""
        ),
      }));

      const aggregateScore =
        Number(parsedJson.aggregate_score) || computeAggregate(criterionScores, rubric);

      const inputTokens = usage.inputTokens ?? 0;
      const outputTokens = usage.outputTokens ?? 0;

      const result: SingleEvalResult = {
        id: nanoid(),
        mode: "single",
        createdAt: new Date().toISOString(),
        input,
        rubric,
        judgeModel,
        chainOfThought: String(parsedJson.chain_of_thought ?? ""),
        criterionScores,
        aggregateScore,
        inputTokens,
        outputTokens,
        estimatedCostUsd:
          (inputTokens / 1_000_000) * judgeModel.inputCostPer1M +
          (outputTokens / 1_000_000) * judgeModel.outputCostPer1M,
      };

      return NextResponse.json(result);
    } else {
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
        model: getModel(modelId, apiKey),
        prompt: judgePrompt,
        temperature: 0.1,
        maxOutputTokens: 4096,
      });

      const cleaned = text
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```\s*$/, "")
        .trim();
      const parsedJson = JSON.parse(cleaned) as Record<string, unknown>;

      const criterionScoresA: CriterionScore[] = rubric.criteria.map((c) => ({
        criterionId: c.id,
        criterionName: c.name,
        score:
          Number((parsedJson.scores as Record<string, unknown>)?.[`${c.id}_A`]) || 0,
        maxScore: c.scoreRange,
        reasoning: String(
          (parsedJson.criterion_reasoning as Record<string, unknown>)?.[
            `${c.id}_A_reasoning`
          ] ?? ""
        ),
      }));

      const criterionScoresB: CriterionScore[] = rubric.criteria.map((c) => ({
        criterionId: c.id,
        criterionName: c.name,
        score:
          Number((parsedJson.scores as Record<string, unknown>)?.[`${c.id}_B`]) || 0,
        maxScore: c.scoreRange,
        reasoning: String(
          (parsedJson.criterion_reasoning as Record<string, unknown>)?.[
            `${c.id}_B_reasoning`
          ] ?? ""
        ),
      }));

      const rawVerdict = String(parsedJson.verdict ?? "tie").toLowerCase();
      const verdict: PairwiseVerdict =
        rawVerdict === "a" ? "A" : rawVerdict === "b" ? "B" : "tie";

      const inputTokens = usage.inputTokens ?? 0;
      const outputTokens = usage.outputTokens ?? 0;

      const result: PairwiseEvalResult = {
        id: nanoid(),
        mode: "pairwise",
        createdAt: new Date().toISOString(),
        input,
        rubric,
        judgeModel,
        chainOfThought: String(parsedJson.chain_of_thought ?? ""),
        criterionScoresA,
        criterionScoresB,
        aggregateScoreA:
          Number(parsedJson.aggregate_score_A) ||
          computeAggregate(criterionScoresA, rubric),
        aggregateScoreB:
          Number(parsedJson.aggregate_score_B) ||
          computeAggregate(criterionScoresB, rubric),
        verdict,
        verdictReasoning: String(parsedJson.verdict_reasoning ?? ""),
        inputTokens,
        outputTokens,
        estimatedCostUsd:
          (inputTokens / 1_000_000) * judgeModel.inputCostPer1M +
          (outputTokens / 1_000_000) * judgeModel.outputCostPer1M,
      };

      return NextResponse.json(result);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
