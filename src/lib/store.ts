import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { EvalResult, Rubric, AppSettings, ApiKeys } from "./types";

interface AppStore {
  // Settings
  settings: AppSettings;
  updateSettings: (patch: Partial<AppSettings>) => void;
  updateApiKey: (
    provider: "openai" | "anthropic" | "google",
    key: string
  ) => void;

  // History
  history: EvalResult[];
  addResult: (result: EvalResult) => void;
  removeResult: (id: string) => void;
  clearHistory: () => void;

  // Custom rubrics
  customRubrics: Rubric[];
  addRubric: (rubric: Rubric) => void;
  updateRubric: (id: string, patch: Partial<Rubric>) => void;
  deleteRubric: (id: string) => void;
}

export const useStore = create<AppStore>()(
  persist(
    (set) => ({
      // Default settings
      settings: {
        apiKeys: {},
        defaultModelId: "gpt-4o",
        defaultRubricId: "builtin-overall",
      },

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

      // History
      history: [],

      addResult: (result) =>
        set((state) => ({
          history: [result, ...state.history],
        })),

      removeResult: (id) =>
        set((state) => ({
          history: state.history.filter((r) => r.id !== id),
        })),

      clearHistory: () => set({ history: [] }),

      // Custom rubrics
      customRubrics: [],

      addRubric: (rubric) =>
        set((state) => ({
          customRubrics: [...state.customRubrics, rubric],
        })),

      updateRubric: (id, patch) =>
        set((state) => ({
          customRubrics: state.customRubrics.map((r) =>
            r.id === id ? { ...r, ...patch } : r
          ),
        })),

      deleteRubric: (id) =>
        set((state) => ({
          customRubrics: state.customRubrics.filter((r) => r.id !== id),
        })),
    }),
    {
      name: "rapid-judge-store",
      storage: createJSONStorage(() => localStorage),
      // Deep-merge persisted state with defaults so partial/stale localStorage
      // data never leaves settings.apiKeys undefined.
      merge: (persisted, current) => {
        const ps = (persisted ?? {}) as Partial<AppStore>;
        const defaultSettings = current.settings;
        const persistedDefaultModelId = ps.settings?.defaultModelId;
        const mergedDefaultModelId =
          !persistedDefaultModelId ||
          persistedDefaultModelId === "claude-3-5-sonnet-20241022"
            ? defaultSettings.defaultModelId
            : persistedDefaultModelId;

        return {
          ...current,
          ...ps,
          settings: {
            ...defaultSettings,
            ...(ps.settings ?? {}),
            defaultModelId: mergedDefaultModelId,
            apiKeys: {
              ...defaultSettings.apiKeys,
              ...((ps.settings?.apiKeys ?? {}) as ApiKeys),
            },
          },
          history: ps.history ?? [],
          customRubrics: ps.customRubrics ?? [],
        };
      },
    }
  )
);
