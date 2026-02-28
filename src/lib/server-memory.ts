import type {
  BiasCheckResult,
  CalibrationRun,
  Dataset,
  DatasetVersion,
  ExperimentRun,
} from "./types";

interface ServerMemoryState {
  datasets: Dataset[];
  datasetVersions: Record<string, DatasetVersion[]>;
  experimentRuns: ExperimentRun[];
  calibrationRuns: CalibrationRun[];
  biasChecks: BiasCheckResult[];
}

declare global {
  var __rapidJudgeMemory: ServerMemoryState | undefined;
}

function createState(): ServerMemoryState {
  return {
    datasets: [],
    datasetVersions: {},
    experimentRuns: [],
    calibrationRuns: [],
    biasChecks: [],
  };
}

export function getServerMemory(): ServerMemoryState {
  if (!globalThis.__rapidJudgeMemory) {
    globalThis.__rapidJudgeMemory = createState();
  }
  return globalThis.__rapidJudgeMemory;
}

export function hashString(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash +=
      (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "dataset"
  );
}

export function round(value: number, digits = 3): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
