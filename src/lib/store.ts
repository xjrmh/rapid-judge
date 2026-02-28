import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type {
  ApiKeys,
  AppSettings,
  EvalResult,
  ExperimentRun,
  JudgePromptVersionRef,
  Rubric,
  RubricVersionRef,
} from "./types";
import {
  buildRubricVersionRef,
  getBuiltInRubricVersionRef,
  getLatestVersionRef,
} from "./rubric-versioning";

const DEFAULT_PROMPT_VERSION: JudgePromptVersionRef = {
  id: "judge-prompt",
  versionNumber: 1,
  createdAt: "2026-01-01T00:00:00.000Z",
  notes: "Structured JSON grading prompt v1",
};

interface AppStore {
  // Settings
  settings: AppSettings;
  updateSettings: (patch: Partial<AppSettings>) => void;
  updateApiKey: (
    provider: "openai" | "anthropic" | "google",
    key: string
  ) => void;
  exportSettings: () => string;
  importSettings: (raw: string) => { ok: true } | { ok: false; error: string };

  // Experiment runs (source of truth)
  experimentRuns: ExperimentRun[];
  addExperimentRun: (run: ExperimentRun) => void;
  removeExperimentRun: (runId: string) => void;
  clearExperimentRuns: () => void;

  // Legacy compatibility projection
  history: EvalResult[];
  addResult: (result: EvalResult) => void;
  removeResult: (resultId: string) => void;
  clearHistory: () => void;

  // Custom rubrics + version history
  customRubrics: Rubric[];
  rubricVersions: Record<string, RubricVersionRef[]>;
  addRubric: (rubric: Rubric) => void;
  updateRubric: (id: string, patch: Partial<Rubric>) => void;
  deleteRubric: (id: string) => void;
  getLatestRubricVersionRef: (rubricId: string) => RubricVersionRef | undefined;
}

function meanOfSingleResult(result: EvalResult): number {
  if (result.mode === "single") return result.aggregateScore;
  return (result.aggregateScoreA + result.aggregateScoreB) / 2;
}

function runFromEval(
  result: EvalResult,
  rubricVersionRef: RubricVersionRef
): ExperimentRun {
  const meanAggregateScore = meanOfSingleResult(result);
  const passRate = meanAggregateScore >= 70 ? 1 : 0;

  return {
    id: `run-${result.id}`,
    identityKey: `adhoc:${result.mode}:${result.id}:${rubricVersionRef.versionId}`,
    createdAt: result.createdAt,
    runType: "adhoc",
    status: "completed",
    config: {
      name: `${result.mode === "single" ? "Single" : "Pairwise"} ad-hoc run`,
      evalMode: result.mode,
      judgeModelId: result.judgeModel.id,
      rubricId: result.rubric.id,
      repeats: 1,
      rubricVersionRef,
      judgePromptVersionRef: DEFAULT_PROMPT_VERSION,
    },
    rubricVersionRef,
    judgePromptVersionRef: DEFAULT_PROMPT_VERSION,
    metrics: {
      caseCount: 1,
      meanAggregateScore: Math.round(meanAggregateScore * 10) / 10,
      passRate,
      winRateA:
        result.mode === "pairwise" ? (result.verdict === "A" ? 1 : 0) : undefined,
      winRateB:
        result.mode === "pairwise" ? (result.verdict === "B" ? 1 : 0) : undefined,
      tieRate:
        result.mode === "pairwise" ? (result.verdict === "tie" ? 1 : 0) : undefined,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      estimatedCostUsd: result.estimatedCostUsd,
    },
    sourceEvalResultIds: [result.id],
    evalResults: [result],
  };
}

function historyFromRuns(runs: ExperimentRun[]): EvalResult[] {
  return runs
    .flatMap((run) => run.evalResults ?? [])
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function ensureRubricVersionMap(
  customRubrics: Rubric[],
  existing?: Record<string, RubricVersionRef[]>
): Record<string, RubricVersionRef[]> {
  const next = { ...(existing ?? {}) };

  for (const rubric of customRubrics) {
    const versions = next[rubric.id];
    if (!versions || versions.length === 0) {
      next[rubric.id] = [buildRubricVersionRef(rubric, 1, rubric.createdAt)];
    }
  }

  return next;
}

function defaultSettings(): AppSettings {
  return {
    apiKeys: {},
    defaultModelId: "gpt-4o",
    defaultRubricId: "builtin-overall",
    alertThresholds: {
      minAgreementRate: 0.75,
      maxScoreDrift: 8,
      maxCostIncreasePct: 20,
    },
  };
}

export const useStore = create<AppStore>()(
  persist(
    (set, get) => ({
      settings: defaultSettings(),

      updateSettings: (patch) =>
        set((state) => ({
          settings: { ...state.settings, ...patch },
        })),

      updateApiKey: (provider, key) =>
        set((state) => ({
          settings: {
            ...state.settings,
            apiKeys: { ...state.settings.apiKeys, [provider]: key || undefined },
          },
        })),

      exportSettings: () => JSON.stringify(get().settings, null, 2),

      importSettings: (raw) => {
        try {
          const parsed = JSON.parse(raw) as Partial<AppSettings>;
          const current = get().settings;
          set({
            settings: {
              ...current,
              ...parsed,
              apiKeys: {
                ...current.apiKeys,
                ...(parsed.apiKeys ?? {}),
              },
              alertThresholds: {
                ...current.alertThresholds,
                ...(parsed.alertThresholds ?? {}),
              },
            },
          });
          return { ok: true };
        } catch (err) {
          const message = err instanceof Error ? err.message : "Invalid JSON";
          return { ok: false, error: message };
        }
      },

      experimentRuns: [],

      addExperimentRun: (run) =>
        set((state) => {
          const next = [run, ...state.experimentRuns.filter((r) => r.id !== run.id)];
          return {
            experimentRuns: next,
            history: historyFromRuns(next),
          };
        }),

      removeExperimentRun: (runId) =>
        set((state) => {
          const next = state.experimentRuns.filter((r) => r.id !== runId);
          return {
            experimentRuns: next,
            history: historyFromRuns(next),
          };
        }),

      clearExperimentRuns: () =>
        set({
          experimentRuns: [],
          history: [],
        }),

      history: [],

      addResult: (result) =>
        set((state) => {
          const rubricVersionRef =
            state.getLatestRubricVersionRef(result.rubric.id) ??
            getBuiltInRubricVersionRef(result.rubric.id) ??
            buildRubricVersionRef(result.rubric, 1, result.rubric.createdAt);

          const run = runFromEval(result, rubricVersionRef);
          const nextRuns = [
            run,
            ...state.experimentRuns.filter((existing) => existing.id !== run.id),
          ];

          return {
            experimentRuns: nextRuns,
            history: historyFromRuns(nextRuns),
          };
        }),

      removeResult: (resultId) =>
        set((state) => {
          const nextRuns = state.experimentRuns
            .map((run) => ({
              ...run,
              evalResults: (run.evalResults ?? []).filter((result) => result.id !== resultId),
              sourceEvalResultIds: run.sourceEvalResultIds.filter((id) => id !== resultId),
            }))
            .filter((run) => run.sourceEvalResultIds.length > 0 || run.runType !== "adhoc");

          return {
            experimentRuns: nextRuns,
            history: historyFromRuns(nextRuns),
          };
        }),

      clearHistory: () =>
        set((state) => {
          const nextRuns = state.experimentRuns.filter((run) => run.runType !== "adhoc");
          return {
            experimentRuns: nextRuns,
            history: historyFromRuns(nextRuns),
          };
        }),

      customRubrics: [],
      rubricVersions: {},

      addRubric: (rubric) =>
        set((state) => {
          const customRubrics = [...state.customRubrics, rubric];
          const existing = state.rubricVersions[rubric.id] ?? [];
          const nextVersionNumber =
            existing.length > 0
              ? existing[existing.length - 1].versionNumber + 1
              : 1;
          const versionRef = buildRubricVersionRef(
            rubric,
            nextVersionNumber,
            rubric.createdAt
          );

          return {
            customRubrics,
            rubricVersions: {
              ...state.rubricVersions,
              [rubric.id]: [...existing, versionRef],
            },
          };
        }),

      updateRubric: (id, patch) =>
        set((state) => {
          const now = new Date().toISOString();
          const updatedRubrics = state.customRubrics.map((rubric) =>
            rubric.id === id
              ? {
                  ...rubric,
                  ...patch,
                }
              : rubric
          );
          const updated = updatedRubrics.find((r) => r.id === id);
          if (!updated) {
            return {
              customRubrics: updatedRubrics,
            };
          }

          const existing = state.rubricVersions[id] ?? [];
          const nextVersionNumber =
            existing.length > 0
              ? existing[existing.length - 1].versionNumber + 1
              : 1;
          const versionRef = buildRubricVersionRef(updated, nextVersionNumber, now);

          return {
            customRubrics: updatedRubrics,
            rubricVersions: {
              ...state.rubricVersions,
              [id]: [...existing, versionRef],
            },
          };
        }),

      deleteRubric: (id) =>
        set((state) => {
          const nextVersionMap = { ...state.rubricVersions };
          delete nextVersionMap[id];
          return {
            customRubrics: state.customRubrics.filter((r) => r.id !== id),
            rubricVersions: nextVersionMap,
          };
        }),

      getLatestRubricVersionRef: (rubricId) =>
        getLatestVersionRef(rubricId, get().rubricVersions),
    }),
    {
      name: "rapid-judge-store",
      storage: createJSONStorage(() => localStorage),
      merge: (persisted, current) => {
        const ps = (persisted ?? {}) as Partial<AppStore>;
        const defaultAppSettings = current.settings;
        const mergedCustomRubrics = ps.customRubrics ?? [];
        const mergedVersionMap = ensureRubricVersionMap(
          mergedCustomRubrics,
          ps.rubricVersions
        );

        const legacyHistory = ps.history ?? [];
        const existingRuns = ps.experimentRuns ?? [];
        const migratedRuns =
          existingRuns.length > 0
            ? existingRuns
            : legacyHistory.map((result) => {
                const versionRef =
                  getLatestVersionRef(result.rubric.id, mergedVersionMap) ??
                  getBuiltInRubricVersionRef(result.rubric.id) ??
                  buildRubricVersionRef(result.rubric, 1, result.rubric.createdAt);
                return runFromEval(result, versionRef);
              });

        const persistedDefaultModelId = ps.settings?.defaultModelId;
        const mergedDefaultModelId =
          !persistedDefaultModelId ||
          persistedDefaultModelId === "claude-3-5-sonnet-20241022"
            ? defaultAppSettings.defaultModelId
            : persistedDefaultModelId;

        return {
          ...current,
          ...ps,
          settings: {
            ...defaultAppSettings,
            ...(ps.settings ?? {}),
            defaultModelId: mergedDefaultModelId,
            apiKeys: {
              ...defaultAppSettings.apiKeys,
              ...((ps.settings?.apiKeys ?? {}) as ApiKeys),
            },
            alertThresholds: {
              ...defaultAppSettings.alertThresholds,
              ...(ps.settings?.alertThresholds ?? {}),
            },
          },
          customRubrics: mergedCustomRubrics,
          rubricVersions: mergedVersionMap,
          experimentRuns: migratedRuns,
          history: historyFromRuns(migratedRuns),
        };
      },
    }
  )
);
