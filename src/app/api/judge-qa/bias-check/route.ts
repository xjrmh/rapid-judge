import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { nanoid } from "nanoid";
import type { BiasCheckResult, PairwiseVerdict } from "@/lib/types";
import { getServerMemory, round } from "@/lib/server-memory";

export const dynamic = "force-dynamic";

const VerdictSchema = z.enum(["A", "B", "tie"]);

const RequestSchema = z.object({
  records: z
    .array(
      z.object({
        verdictAB: VerdictSchema.optional(),
        verdictBA: VerdictSchema.optional(),
        responseALength: z.number().nonnegative().optional(),
        responseBLength: z.number().nonnegative().optional(),
        aggregateScoreA: z.number().min(0).max(100).optional(),
        aggregateScoreB: z.number().min(0).max(100).optional(),
        winningModelLabel: z.string().optional(),
        judgeModelLabel: z.string().optional(),
      })
    )
    .min(1),
});

function pearson(x: number[], y: number[]): number {
  if (x.length === 0 || y.length === 0 || x.length !== y.length) return 0;
  const n = x.length;
  const mx = x.reduce((sum, value) => sum + value, 0) / n;
  const my = y.reduce((sum, value) => sum + value, 0) / n;

  let numerator = 0;
  let xDen = 0;
  let yDen = 0;

  for (let i = 0; i < n; i++) {
    const dx = x[i] - mx;
    const dy = y[i] - my;
    numerator += dx * dy;
    xDen += dx * dx;
    yDen += dy * dy;
  }

  if (xDen === 0 || yDen === 0) return 0;
  return numerator / Math.sqrt(xDen * yDen);
}

function verdictChanged(a?: PairwiseVerdict, b?: PairwiseVerdict): boolean {
  if (!a || !b) return false;
  return a !== b;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = RequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid bias-check payload", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { records } = parsed.data;

    const withVerdictPairs = records.filter(
      (record) => !!record.verdictAB && !!record.verdictBA
    );
    const flipCount = withVerdictPairs.filter((record) =>
      verdictChanged(record.verdictAB, record.verdictBA)
    ).length;
    const positionFlipRate =
      withVerdictPairs.length === 0 ? 0 : flipCount / withVerdictPairs.length;

    const verbosityRows = records.filter(
      (record) =>
        typeof record.responseALength === "number" &&
        typeof record.responseBLength === "number" &&
        typeof record.aggregateScoreA === "number" &&
        typeof record.aggregateScoreB === "number"
    );
    const lengthDelta = verbosityRows.map(
      (record) => (record.responseALength as number) - (record.responseBLength as number)
    );
    const scoreDelta = verbosityRows.map(
      (record) => (record.aggregateScoreA as number) - (record.aggregateScoreB as number)
    );

    const selfPrefRows = records.filter(
      (record) =>
        !!record.winningModelLabel &&
        !!record.judgeModelLabel &&
        record.winningModelLabel.trim().length > 0 &&
        record.judgeModelLabel.trim().length > 0
    );
    const selfPreferenceRate =
      selfPrefRows.length === 0
        ? 0
        : selfPrefRows.filter(
            (record) =>
              record.winningModelLabel?.trim().toLowerCase() ===
              record.judgeModelLabel?.trim().toLowerCase()
          ).length / selfPrefRows.length;

    const result: BiasCheckResult = {
      id: `bias-${nanoid()}`,
      createdAt: new Date().toISOString(),
      sampleSize: records.length,
      positionFlipRate: round(positionFlipRate, 4),
      verbosityBiasCorrelation: round(pearson(lengthDelta, scoreDelta), 4),
      selfPreferenceRate: round(selfPreferenceRate, 4),
      flags: [],
    };

    if (result.positionFlipRate > 0.15) {
      result.flags.push("High position-bias flip rate (>15%).");
    }
    if (Math.abs(result.verbosityBiasCorrelation) > 0.2) {
      result.flags.push("Meaningful score/length correlation detected.");
    }
    if (result.selfPreferenceRate > 0.5) {
      result.flags.push("Possible self-preference signal (>50%).");
    }

    const memory = getServerMemory();
    memory.biasChecks = [result, ...memory.biasChecks];

    return NextResponse.json({ result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
