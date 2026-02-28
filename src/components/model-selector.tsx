"use client";

import { useEffect, useState } from "react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MODELS_BY_PROVIDER } from "@/lib/models";
import { useStore } from "@/lib/store";
import { hasApiKey } from "@/lib/api-key-headers";
import type { Provider } from "@/lib/types";

interface ModelSelectorProps {
  value: string;
  onValueChange: (value: string) => void;
}

const PROVIDER_LABELS: Record<string, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  google: "Google",
};

const EMPTY_ENV_PROVIDER_KEYS: Record<Provider, boolean> = {
  openai: false,
  anthropic: false,
  google: false,
};

export function ModelSelector({ value, onValueChange }: ModelSelectorProps) {
  const { settings } = useStore();
  const [envProviderKeys, setEnvProviderKeys] = useState<Record<Provider, boolean>>(
    EMPTY_ENV_PROVIDER_KEYS
  );

  useEffect(() => {
    const abortController = new AbortController();

    async function loadProviderKeyAvailability() {
      try {
        const res = await fetch("/api/runtime/provider-keys", {
          cache: "no-store",
          signal: abortController.signal,
        });
        if (!res.ok) return;
        const data = (await res.json()) as Partial<Record<Provider, unknown>>;
        setEnvProviderKeys({
          openai: !!data.openai,
          anthropic: !!data.anthropic,
          google: !!data.google,
        });
      } catch {
        // Ignore fetch errors and default to local-key-only behavior.
      }
    }

    loadProviderKeyAvailability();
    return () => abortController.abort();
  }, []);

  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder="Select judge model…" />
      </SelectTrigger>
      <SelectContent>
        {Object.entries(MODELS_BY_PROVIDER).map(([provider, models]) => (
          <SelectGroup key={provider}>
            <SelectLabel>{PROVIDER_LABELS[provider]}</SelectLabel>
            {models.map((model) => {
              const typedProvider = provider as Provider;
              const hasLocalKey = hasApiKey(model.id, settings?.apiKeys ?? {});
              const hasEnvKey = envProviderKeys[typedProvider];
              const hasKey = hasLocalKey || hasEnvKey;
              const showDemo = !hasLocalKey && hasEnvKey;

              return (
                <SelectItem
                  key={model.id}
                  value={model.id}
                  disabled={!hasKey}
                  className={!hasKey ? "opacity-40" : ""}
                >
                  <span>{model.name}</span>
                  {showDemo ? (
                    <span className="ml-2 text-xs text-amber-700">
                      (demo)
                    </span>
                  ) : !hasKey ? (
                    <span className="ml-2 text-xs text-muted-foreground">
                      (no key)
                    </span>
                  ) : null}
                </SelectItem>
              );
            })}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  );
}
