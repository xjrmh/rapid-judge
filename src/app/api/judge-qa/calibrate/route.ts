import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { nanoid } from "nanoid";
import type { CalibrationRun, PairwiseVerdict } from "@/lib/types";
import { getServerMemory, round } from "@/lib/server-memory";

export const dynamic = "force-dynamic";

const VerdictSchema = z.enum(["A", "B", "tie"]);

const RequestSchema = z.object({
  setName: z.string().min(1).default("Untitled Calibration Set"),
  records: z
    .array(
      z.object({
        id: z.string().optional(),
        prompt: z.string().optional(),
        humanVerdict: VerdictSchema.optional(),
        judgeVerdict: VerdictSchema.optional(),
        humanScore: z.number().min(0).max(100).optional(),
        judgeScore: z.number().min(0).max(100).optional(),
      })
    )
    .min(1),
});

function cohenKappa(human: PairwiseVerdict[], judge: PairwiseVerdict[]): number {
  if (human.length === 0 || judge.length === 0 || human.length !== judge.length) return 0;
  const labels: PairwiseVerdict[] = ["A", "B", "tie"];
  const n = human.length;

  let observed = 0;
  const humanCounts: Record<PairwiseVerdict, number> = { A: 0, B: 0, tie: 0 };
  const judgeCounts: Record<PairwiseVerdict, number> = { A: 0, B: 0, tie: 0 };

  for (let i = 0; i < n; i++) {
    const h = human[i];
    const j = judge[i];
    if (h === j) observed += 1;
    humanCounts[h] += 1;
    judgeCounts[j] += 1;
  }

  const p0 = observed / n;
  const pe = labels.reduce(
    (sum, label) => sum + (humanCounts[label] / n) * (judgeCounts[label] / n),
    0
  );

  if (pe >= 0.999999) return 0;
  return (p0 - pe) / (1 - pe);
}

function pearson(x: number[], y: number[]): number {
  if (x.length === 0 || y.length === 0 || x.length !== y.length) return 0;
  const n = x.length;
  const meanX = x.reduce((sum, v) => sum + v, 0) / n;
  const meanY = y.reduce((sum, v) => sum + v, 0) / n;

  let numerator = 0;
  let denX = 0;
  let denY = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i] - meanX;
    const dy = y[i] - meanY;
    numerator += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }

  if (denX === 0 || denY === 0) return 0;
  return numerator / Math.sqrt(denX * denY);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = RequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid calibration payload", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { setName, records } = parsed.data;
    const verdictPairs = records.filter(
      (record) => !!record.humanVerdict && !!record.judgeVerdict
    );
    const exactMatches = verdictPairs.filter(
      (record) => record.humanVerdict === record.judgeVerdict
    ).length;

    const scorePairs = records.filter(
      (record) =>
        typeof record.humanScore === "number" && typeof record.judgeScore === "number"
    );
    const humanScores = scorePairs.map((record) => record.humanScore as number);
    const judgeScores = scorePairs.map((record) => record.judgeScore as number);
    const meanAbsoluteError =
      scorePairs.length === 0
        ? undefined
        : scorePairs.reduce((sum, record) => {
            const a = record.humanScore as number;
            const b = record.judgeScore as number;
            return sum + Math.abs(a - b);
          }, 0) / scorePairs.length;

    const run: CalibrationRun = {
      id: `cal-${nanoid()}`,
      createdAt: new Date().toISOString(),
      setName,
      metrics: {
        sampleSize: records.length,
        exactMatchRate:
          verdictPairs.length === 0 ? 0 : round(exactMatches / verdictPairs.length, 4),
        cohenKappa: round(
          cohenKappa(
            verdictPairs.map((record) => record.humanVerdict as PairwiseVerdict),
            verdictPairs.map((record) => record.judgeVerdict as PairwiseVerdict)
          ),
          4
        ),
        scoreCorrelation:
          scorePairs.length === 0 ? undefined : round(pearson(humanScores, judgeScores), 4),
        meanAbsoluteError:
          meanAbsoluteError === undefined ? undefined : round(meanAbsoluteError, 4),
      },
      notes:
        "Agreement metrics computed from provided human/judge labels. Use consistent labeling standards for calibration.",
    };

    const memory = getServerMemory();
    memory.calibrationRuns = [run, ...memory.calibrationRuns];

    return NextResponse.json({ run });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
