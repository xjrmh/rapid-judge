import { BUILT_IN_RUBRICS } from "./rubric-templates";
import type { Rubric, RubricVersionRef } from "./types";

function hashString(input: string): string {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash +=
      (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function rubricFingerprint(rubric: Rubric): string {
  const normalized = JSON.stringify({
    id: rubric.id,
    name: rubric.name.trim(),
    description: rubric.description.trim(),
    criteria: rubric.criteria.map((c) => ({
      id: c.id,
      name: c.name.trim(),
      description: c.description.trim(),
      weight: Math.round(c.weight * 10_000) / 10_000,
      scoreRange: c.scoreRange,
    })),
  });

  return hashString(normalized);
}

export function buildRubricVersionRef(
  rubric: Rubric,
  versionNumber: number,
  createdAt = new Date().toISOString()
): RubricVersionRef {
  const fingerprint = rubricFingerprint(rubric);
  return {
    rubricId: rubric.id,
    versionId: `${rubric.id}:v${versionNumber}:${fingerprint}`,
    versionNumber,
    fingerprint,
    createdAt,
    isBuiltIn: rubric.isBuiltIn,
  };
}

const BUILT_IN_VERSION_MAP: Record<string, RubricVersionRef> = Object.fromEntries(
  BUILT_IN_RUBRICS.map((rubric) => [
    rubric.id,
    buildRubricVersionRef(rubric, 1, rubric.createdAt),
  ])
);

export function getBuiltInRubricVersionRef(
  rubricId: string
): RubricVersionRef | undefined {
  return BUILT_IN_VERSION_MAP[rubricId];
}

export function getLatestVersionRef(
  rubricId: string,
  versionMap: Record<string, RubricVersionRef[]>
): RubricVersionRef | undefined {
  const custom = versionMap[rubricId];
  if (custom && custom.length > 0) {
    return custom[custom.length - 1];
  }
  return getBuiltInRubricVersionRef(rubricId);
}
