import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { CriterionScore, RubricCriterion } from "./types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Color classes based on percentage score (0–100)
export function scoreToColorClass(score: number, maxScore: number): string {
  const pct = (score / maxScore) * 100;
  if (pct >= 70) return "text-green-700 bg-green-50 border-green-200";
  if (pct >= 40) return "text-yellow-700 bg-yellow-50 border-yellow-200";
  return "text-red-700 bg-red-50 border-red-200";
}

export function scoreToBarColor(score: number, maxScore: number): string {
  const pct = (score / maxScore) * 100;
  if (pct >= 70) return "bg-green-500";
  if (pct >= 40) return "bg-yellow-500";
  return "bg-red-500";
}

// Compute aggregate score (0–100) from criterion scores
export function computeAggregateScore(
  criterionScores: CriterionScore[],
  criteria: RubricCriterion[]
): number {
  let weightedSum = 0;
  let totalWeight = 0;

  for (const cs of criterionScores) {
    const criterion = criteria.find((c) => c.id === cs.criterionId);
    if (!criterion) continue;
    const normalized = (cs.score / cs.maxScore) * 100;
    weightedSum += normalized * criterion.weight;
    totalWeight += criterion.weight;
  }

  if (totalWeight === 0) return 0;
  return Math.round((weightedSum / totalWeight) * 10) / 10;
}

// Format cost in USD
export function formatCost(usd: number): string {
  if (usd < 0.001) return `$${(usd * 1000).toFixed(3)}m`;
  if (usd < 0.01) return `$${usd.toFixed(4)}`;
  if (usd < 1) return `$${usd.toFixed(3)}`;
  return `$${usd.toFixed(2)}`;
}

// Format token count
export function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return `${n}`;
}

// Format date
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Truncate text for previews
export function truncate(text: string, maxLen = 80): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen).trim() + "…";
}
