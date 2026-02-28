import type { ModelSpec, Provider } from "./types";

export const MODELS: ModelSpec[] = [
  // OpenAI
  {
    id: "gpt-4o",
    name: "GPT-4o",
    provider: "openai",
    inputCostPer1M: 2.5,
    outputCostPer1M: 10.0,
  },
  {
    id: "gpt-4o-mini",
    name: "GPT-4o mini",
    provider: "openai",
    inputCostPer1M: 0.15,
    outputCostPer1M: 0.6,
  },
  {
    id: "gpt-4-turbo",
    name: "GPT-4 Turbo",
    provider: "openai",
    inputCostPer1M: 10.0,
    outputCostPer1M: 30.0,
  },
  // Anthropic
  {
    id: "claude-3-5-sonnet-20241022",
    name: "Claude 3.5 Sonnet",
    provider: "anthropic",
    inputCostPer1M: 3.0,
    outputCostPer1M: 15.0,
  },
  {
    id: "claude-3-5-haiku-20241022",
    name: "Claude 3.5 Haiku",
    provider: "anthropic",
    inputCostPer1M: 0.8,
    outputCostPer1M: 4.0,
  },
  {
    id: "claude-3-opus-20240229",
    name: "Claude 3 Opus",
    provider: "anthropic",
    inputCostPer1M: 15.0,
    outputCostPer1M: 75.0,
  },
  // Google
  {
    id: "gemini-1.5-pro",
    name: "Gemini 1.5 Pro",
    provider: "google",
    inputCostPer1M: 1.25,
    outputCostPer1M: 5.0,
  },
  {
    id: "gemini-1.5-flash",
    name: "Gemini 1.5 Flash",
    provider: "google",
    inputCostPer1M: 0.075,
    outputCostPer1M: 0.3,
  },
  {
    id: "gemini-2.0-flash",
    name: "Gemini 2.0 Flash",
    provider: "google",
    inputCostPer1M: 0.1,
    outputCostPer1M: 0.4,
  },
];

export const MODELS_BY_PROVIDER: Record<Provider, ModelSpec[]> = {
  openai: MODELS.filter((m) => m.provider === "openai"),
  anthropic: MODELS.filter((m) => m.provider === "anthropic"),
  google: MODELS.filter((m) => m.provider === "google"),
};

export function getModelById(id: string): ModelSpec | undefined {
  return MODELS.find((m) => m.id === id);
}

export function resolveProvider(modelId: string): Provider {
  if (modelId.startsWith("gpt-")) return "openai";
  if (modelId.startsWith("claude-")) return "anthropic";
  if (modelId.startsWith("gemini-")) return "google";
  throw new Error(`Unknown provider for model: ${modelId}`);
}
