import type { ApiKeys } from "./types";
import { MODELS, resolveProvider } from "./models";

export function getApiKeyHeaders(
  modelId: string,
  apiKeys: ApiKeys
): Record<string, string> {
  const provider = resolveProvider(modelId);
  const headers: Record<string, string> = {};

  if (provider === "openai" && apiKeys.openai) {
    headers["x-openai-api-key"] = apiKeys.openai;
  } else if (provider === "anthropic" && apiKeys.anthropic) {
    headers["x-anthropic-api-key"] = apiKeys.anthropic;
  } else if (provider === "google" && apiKeys.google) {
    headers["x-google-api-key"] = apiKeys.google;
  }

  return headers;
}

export function hasApiKey(modelId: string, apiKeys: ApiKeys): boolean {
  try {
    const provider = resolveProvider(modelId);
    if (provider === "openai") return !!apiKeys.openai;
    if (provider === "anthropic") return !!apiKeys.anthropic;
    if (provider === "google") return !!apiKeys.google;
    return false;
  } catch {
    return false;
  }
}

/** Returns true if the user has configured at least one API key for any provider. */
export function hasAnyApiKey(apiKeys: ApiKeys): boolean {
  return !!(apiKeys.openai || apiKeys.anthropic || apiKeys.google);
}

/**
 * Returns the id of the best default model given the configured keys.
 * Prefers anthropic → openai → google. Returns undefined if no keys are set.
 */
export function getDefaultModelId(apiKeys: ApiKeys): string | undefined {
  const preferredOrder: Array<keyof ApiKeys> = ["anthropic", "openai", "google"];
  for (const provider of preferredOrder) {
    if (apiKeys[provider]) {
      const model = MODELS.find((m) => m.provider === provider);
      if (model) return model.id;
    }
  }
  return undefined;
}
