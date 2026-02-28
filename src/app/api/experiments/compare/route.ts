import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { ExperimentRun, RunComparison } from "@/lib/types";
import { getServerMemory, round } from "@/lib/server-memory";

export const dynamic = "force-dynamic";

const RequestSchema = z.object({
  baselineRunId: z.string().min(1),
  candidateRunId: z.string().min(1),
});

function findRun(runId: string, runs: ExperimentRun[]): ExperimentRun | undefined {
  return runs.find((run) => run.id === runId);
}

function verdictFromDeltas(
  scoreDelta: number,
  passDelta: number,
  costDelta: number
): RunComparison["verdict"] {
  const improvedQuality = scoreDelta > 0 || passDelta > 0;
  const regressedQuality = scoreDelta < 0 || passDelta < 0;

  if (!improvedQuality && !regressedQuality && costDelta === 0) {
    return "inconclusive";
  }
  if (improvedQuality && !regressedQuality && costDelta <= 0) {
    return "improved";
  }
  if (regressedQuality && !improvedQuality && costDelta >= 0) {
    return "regressed";
  }
  return "mixed";
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = RequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid compare request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const memory = getServerMemory();
    const baseline = findRun(parsed.data.baselineRunId, memory.experimentRuns);
    const candidate = findRun(parsed.data.candidateRunId, memory.experimentRuns);

    if (!baseline || !candidate) {
      return NextResponse.json({ error: "Run not found" }, { status: 404 });
    }

    const warnings: string[] = [];
    if (baseline.config.evalMode !== candidate.config.evalMode) {
      warnings.push("Evaluation modes differ across compared runs.");
    }
    if ((baseline.datasetVersionId ?? "") !== (candidate.datasetVersionId ?? "")) {
      warnings.push("Dataset versions differ across compared runs.");
    }
    if (
      (baseline.rubricVersionRef?.versionId ?? "") !==
      (candidate.rubricVersionRef?.versionId ?? "")
    ) {
      warnings.push("Rubric versions differ across compared runs.");
    }
    if (
      (baseline.judgePromptVersionRef?.versionNumber ?? 1) !==
      (candidate.judgePromptVersionRef?.versionNumber ?? 1)
    ) {
      warnings.push("Judge prompt versions differ across compared runs.");
    }

    const scoreDelta = round(
      candidate.metrics.meanAggregateScore - baseline.metrics.meanAggregateScore,
      2
    );
    const passDelta = round(candidate.metrics.passRate - baseline.metrics.passRate, 4);
    const costDelta = round(
      candidate.metrics.estimatedCostUsd - baseline.metrics.estimatedCostUsd,
      6
    );

    const comparison: RunComparison = {
      baselineRunId: baseline.id,
      candidateRunId: candidate.id,
      compatible: warnings.length === 0,
      warnings,
      verdict: verdictFromDeltas(scoreDelta, passDelta, costDelta),
      deltas: {
        meanAggregateScore: scoreDelta,
        passRate: passDelta,
        estimatedCostUsd: costDelta,
        inputTokens: candidate.metrics.inputTokens - baseline.metrics.inputTokens,
        outputTokens: candidate.metrics.outputTokens - baseline.metrics.outputTokens,
        winRateA:
          typeof baseline.metrics.winRateA === "number" &&
          typeof candidate.metrics.winRateA === "number"
            ? round(candidate.metrics.winRateA - baseline.metrics.winRateA, 4)
            : undefined,
        winRateB:
          typeof baseline.metrics.winRateB === "number" &&
          typeof candidate.metrics.winRateB === "number"
            ? round(candidate.metrics.winRateB - baseline.metrics.winRateB, 4)
            : undefined,
        tieRate:
          typeof baseline.metrics.tieRate === "number" &&
          typeof candidate.metrics.tieRate === "number"
            ? round(candidate.metrics.tieRate - baseline.metrics.tieRate, 4)
            : undefined,
      },
    };

    return NextResponse.json({ comparison });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
