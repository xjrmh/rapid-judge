"use client";

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

interface ModelSelectorProps {
  value: string;
  onValueChange: (value: string) => void;
}

const PROVIDER_LABELS: Record<string, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  google: "Google",
};

export function ModelSelector({ value, onValueChange }: ModelSelectorProps) {
  const { settings } = useStore();

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
              const hasKey = hasApiKey(model.id, settings?.apiKeys ?? {});
              return (
                <SelectItem
                  key={model.id}
                  value={model.id}
                  disabled={!hasKey}
                  className={!hasKey ? "opacity-40" : ""}
                >
                  <span>{model.name}</span>
                  {!hasKey && (
                    <span className="ml-2 text-xs text-muted-foreground">
                      (no key)
                    </span>
                  )}
                </SelectItem>
              );
            })}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  );
}
