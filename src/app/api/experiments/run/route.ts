import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { nanoid } from "nanoid";
import type { DatasetVersion, ExperimentRun, PairwiseVerdict, RunConfig } from "@/lib/types";
import { getModelById } from "@/lib/models";
import { getServerMemory, hashString, round } from "@/lib/server-memory";

export const dynamic = "force-dynamic";

const RequestSchema = z.object({
  name: z.string().optional(),
  datasetId: z.string().min(1),
  datasetVersionId: z.string().optional(),
  evalMode: z.enum(["single", "pairwise"]),
  judgeModelId: z.string().min(1),
  rubricId: z.string().min(1),
  repeats: z.number().int().min(1).max(10).default(1),
  ensemble: z
    .array(
      z.object({
        modelId: z.string().min(1),
        weight: z.number().positive(),
      })
    )
    .min(1)
    .optional(),
  rubricVersionRef: z
    .object({
      rubricId: z.string().min(1),
      versionId: z.string().min(1),
      versionNumber: z.number().int().positive(),
      fingerprint: z.string().min(1),
      createdAt: z.string().min(1),
      isBuiltIn: z.boolean(),
    })
    .optional(),
  judgePromptVersionRef: z
    .object({
      id: z.string().min(1),
      versionNumber: z.number().int().positive(),
      createdAt: z.string().min(1),
      notes: z.string().optional(),
    })
    .optional(),
  gates: z
    .object({
      minMeanAggregateScore: z.number().min(0).max(100).optional(),
      minPassRate: z.number().min(0).max(1).optional(),
    })
    .optional(),
});

function pickDatasetVersion(
  versions: DatasetVersion[],
  datasetVersionId?: string
): DatasetVersion | undefined {
  if (!datasetVersionId) return versions[versions.length - 1];
  return versions.find((version) => version.id === datasetVersionId);
}

function seededRange(seed: string, min: number, max: number): number {
  const h = Number.parseInt(hashString(seed), 16);
  const span = max - min + 1;
  return min + (h % span);
}

function seededVerdict(seed: string): PairwiseVerdict {
  const h = Number.parseInt(hashString(seed), 16);
  const mod = h % 3;
  if (mod === 0) return "A";
  if (mod === 1) return "B";
  return "tie";
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = RequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid experiment run request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const memory = getServerMemory();
    const input = parsed.data;
    const dataset = memory.datasets.find((d) => d.id === input.datasetId);
    if (!dataset) {
      return NextResponse.json({ error: "Dataset not found" }, { status: 404 });
    }

    const versions = memory.datasetVersions[dataset.id] ?? [];
    if (versions.length === 0) {
      return NextResponse.json(
        { error: "Dataset has no imported versions" },
        { status: 400 }
      );
    }

    const version = pickDatasetVersion(versions, input.datasetVersionId);
    if (!version) {
      return NextResponse.json({ error: "Dataset version not found" }, { status: 404 });
    }

    const selectedJudgeModel = getModelById(input.judgeModelId);
    if (!selectedJudgeModel) {
      return NextResponse.json({ error: "Unknown judge model" }, { status: 400 });
    }

    const ensemble =
      input.ensemble && input.ensemble.length > 0
        ? input.ensemble
        : [{ modelId: input.judgeModelId, weight: 1 }];

    const ensembleModels = ensemble
      .map((entry) => ({
        entry,
        model: getModelById(entry.modelId),
      }))
      .filter((entry) => !!entry.model) as Array<{
      entry: { modelId: string; weight: number };
      model: NonNullable<ReturnType<typeof getModelById>>;
    }>;

    if (ensembleModels.length !== ensemble.length) {
      return NextResponse.json(
        { error: "One or more ensemble models are unknown" },
        { status: 400 }
      );
    }

    const config: RunConfig = {
      name: input.name?.trim() || `${dataset.name} / ${input.evalMode}`,
      datasetId: dataset.id,
      datasetVersionId: version.id,
      evalMode: input.evalMode,
      judgeModelId: input.judgeModelId,
      rubricId: input.rubricId,
      repeats: input.repeats,
      ensemble,
      rubricVersionRef: input.rubricVersionRef,
      judgePromptVersionRef: input.judgePromptVersionRef,
      gates: input.gates,
    };

    const identityRaw = JSON.stringify({
      datasetId: config.datasetId,
      datasetVersionId: config.datasetVersionId,
      evalMode: config.evalMode,
      judgeModelId: config.judgeModelId,
      rubricId: config.rubricId,
      rubricVersionId: config.rubricVersionRef?.versionId ?? "unknown",
      promptVersionId: config.judgePromptVersionRef?.id ?? "unknown",
      promptVersionNumber: config.judgePromptVersionRef?.versionNumber ?? 1,
      repeats: config.repeats,
      itemHash: version.hash,
      ensemble: config.ensemble ?? [],
    });
    const identityKey = hashString(identityRaw);

    let scoreSum = 0;
    let passCount = 0;
    let winA = 0;
    let winB = 0;
    let ties = 0;
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let totalCostUsd = 0;

    for (let repeat = 0; repeat < config.repeats; repeat++) {
      for (const item of version.items) {
        const seed = `${identityKey}:${repeat}:${item.id}`;
        const aggregateScore = seededRange(seed, 45, 100);
        scoreSum += aggregateScore;
        if (aggregateScore >= 70) passCount += 1;

        if (config.evalMode === "pairwise") {
          const verdict = seededVerdict(seed);
          if (verdict === "A") winA += 1;
          else if (verdict === "B") winB += 1;
          else ties += 1;
        }

        const promptTokens = Math.max(20, Math.round(item.prompt.length / 4));
        const responseTokens =
          config.evalMode === "single"
            ? Math.max(20, Math.round((item.response ?? "").length / 4))
            : Math.max(
                40,
                Math.round(((item.responseA ?? "").length + (item.responseB ?? "").length) / 4)
              );

        const inputTokens = promptTokens + Math.round(responseTokens * 0.6);
        const outputTokens = Math.max(32, Math.round(responseTokens * 0.25));

        totalInputTokens += inputTokens;
        totalOutputTokens += outputTokens;

        const totalWeight = ensembleModels.reduce(
          (sum, item) => sum + item.entry.weight,
          0
        );
        for (const model of ensembleModels) {
          const w = model.entry.weight / totalWeight;
          totalCostUsd +=
            ((inputTokens / 1_000_000) * model.model.inputCostPer1M +
              (outputTokens / 1_000_000) * model.model.outputCostPer1M) *
            w;
        }
      }
    }

    const caseCount = version.items.length * config.repeats;
    const meanAggregateScore = caseCount > 0 ? scoreSum / caseCount : 0;
    const passRate = caseCount > 0 ? passCount / caseCount : 0;
    const estimatedCostUsd = totalCostUsd;

    const reasons: string[] = [];
    if (typeof config.gates?.minMeanAggregateScore === "number") {
      if (meanAggregateScore < config.gates.minMeanAggregateScore) {
        reasons.push(
          `Mean score ${round(meanAggregateScore, 1)} is below gate ${config.gates.minMeanAggregateScore}.`
        );
      }
    }
    if (typeof config.gates?.minPassRate === "number") {
      if (passRate < config.gates.minPassRate) {
        reasons.push(
          `Pass rate ${round(passRate * 100, 1)}% is below gate ${round(config.gates.minPassRate * 100, 1)}%.`
        );
      }
    }

    const run: ExperimentRun = {
      id: `exp-${nanoid()}`,
      identityKey,
      createdAt: new Date().toISOString(),
      runType: "dataset",
      status: "completed",
      config,
      datasetVersionId: version.id,
      rubricVersionRef: config.rubricVersionRef,
      judgePromptVersionRef: config.judgePromptVersionRef,
      metrics: {
        caseCount,
        meanAggregateScore: round(meanAggregateScore, 1),
        passRate: round(passRate, 4),
        winRateA: config.evalMode === "pairwise" ? round(winA / caseCount, 4) : undefined,
        winRateB: config.evalMode === "pairwise" ? round(winB / caseCount, 4) : undefined,
        tieRate: config.evalMode === "pairwise" ? round(ties / caseCount, 4) : undefined,
        inputTokens: totalInputTokens,
        outputTokens: totalOutputTokens,
        estimatedCostUsd: round(estimatedCostUsd, 6),
      },
      regression: {
        passed: reasons.length === 0,
        reasons,
      },
      sourceEvalResultIds: [],
      notes:
        "Synthetic deterministic run seeded from config identity for local-first experimentation.",
    };

    memory.experimentRuns = [
      run,
      ...memory.experimentRuns.filter((existing) => existing.id !== run.id),
    ];

    return NextResponse.json({ run });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
