import type { PairwiseVerdict, ScoreRange } from "./types";

export class JudgeJsonParseError extends Error {
  raw: string;

  constructor(message: string, raw: string) {
    super(message);
    this.raw = raw;
  }
}

function toFiniteNumber(value: unknown): number | undefined {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : undefined;
}

export function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export function parseJudgeJson(text: string): Record<string, unknown> {
  const cleaned = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/, "")
    .trim();

  try {
    const parsed = JSON.parse(cleaned);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("not-object");
    }
    return parsed as Record<string, unknown>;
  } catch {
    throw new JudgeJsonParseError("Judge returned invalid JSON", text);
  }
}

export function normalizeCriterionScore(raw: unknown, maxScore: ScoreRange): number {
  const n = toFiniteNumber(raw);
  if (n === undefined) return 1;
  return Math.round(clamp(n, 1, maxScore));
}

export function normalizeAggregateScore(raw: unknown, fallback: number): number {
  const n = toFiniteNumber(raw);
  const value = n === undefined ? fallback : n;
  return Math.round(clamp(value, 0, 100) * 10) / 10;
}

export function normalizeVerdict(raw: unknown): PairwiseVerdict {
  const v = String(raw ?? "tie").trim().toLowerCase();
  if (v === "a") return "A";
  if (v === "b") return "B";
  return "tie";
}

export function normalizeText(raw: unknown): string {
  return typeof raw === "string" ? raw.trim() : "";
}
