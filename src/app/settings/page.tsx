"use client";

import { useRef, useState } from "react";
import { Eye, EyeOff, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useStore } from "@/lib/store";
import { PRIVACY_COPY } from "@/lib/privacy-copy";
import { ModelSelector } from "@/components/model-selector";
import { RubricSelector } from "@/components/rubric-selector";
import { toast } from "sonner";

function ApiKeyField({
  label,
  provider,
  placeholder,
  docsUrl,
}: {
  label: string;
  provider: "openai" | "anthropic" | "google";
  placeholder: string;
  docsUrl: string;
}) {
  const { settings, updateApiKey } = useStore();
  const [show, setShow] = useState(false);
  const value = settings?.apiKeys?.[provider] ?? "";

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label htmlFor={`key-${provider}`} className="text-sm font-medium">
          {label}
        </Label>
        <a
          href={docsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
        >
          Get API key ↗
        </a>
      </div>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Input
            id={`key-${provider}`}
            type={show ? "text" : "password"}
            value={value}
            onChange={(e) => updateApiKey(provider, e.target.value)}
            placeholder={placeholder}
            className="pr-10 font-mono text-sm"
          />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {value && (
          <Button
            variant="outline"
            size="icon"
            onClick={() => updateApiKey(provider, "")}
            title="Clear key"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
      {value ? (
        <p className="text-xs text-green-600">✓ Key configured ({value.slice(0, 8)}…)</p>
      ) : (
        <p className="text-xs text-muted-foreground">No key set — models from this provider will be unavailable.</p>
      )}
    </div>
  );
}

export default function SettingsPage() {
  const { settings, updateSettings, exportSettings, importSettings } = useStore();
  const importInputRef = useRef<HTMLInputElement>(null);

  function handleExport() {
    const json = exportSettings();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rapid-judge-settings-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Settings exported.");
  }

  async function handleImport(file: File) {
    const raw = await file.text();
    const result = importSettings(raw);
    if (result.ok) {
      toast.success("Settings imported.");
    } else {
      toast.error(`Import failed: ${result.error}`);
    }
  }

  return (
    <div className="tab-page max-w-3xl">
      <div className="tab-header">
        <h1 className="tab-title">Settings</h1>
        <p className="tab-subtitle">
          Configure your API keys. You only need keys for the providers you want to use as judges.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">API Keys</CardTitle>
          <CardDescription>
            Configure only the providers you plan to use for judging.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <ApiKeyField
            label="OpenAI"
            provider="openai"
            placeholder="sk-..."
            docsUrl="https://platform.openai.com/api-keys"
          />
          <Separator />
          <ApiKeyField
            label="Anthropic"
            provider="anthropic"
            placeholder="sk-ant-..."
            docsUrl="https://console.anthropic.com/settings/keys"
          />
          <Separator />
          <ApiKeyField
            label="Google AI"
            provider="google"
            placeholder="AIza..."
            docsUrl="https://aistudio.google.com/app/apikey"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Defaults</CardTitle>
          <CardDescription>
            Configure default judge and rubric selections for new evaluations and runs.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Default Judge Model</Label>
            <ModelSelector
              value={settings.defaultModelId}
              onValueChange={(value) => updateSettings({ defaultModelId: value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Default Rubric</Label>
            <RubricSelector
              value={settings.defaultRubricId}
              onValueChange={(value) => updateSettings({ defaultRubricId: value })}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Settings Export/Import</CardTitle>
          <CardDescription>
            Export settings JSON for backup or import into another local environment.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <input
            ref={importInputRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              void handleImport(file);
              e.currentTarget.value = "";
            }}
          />
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleExport}>
              Export Settings
            </Button>
            <Button
              variant="outline"
              onClick={() => importInputRef.current?.click()}
            >
              Import Settings
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="rounded-md bg-muted/50 border p-4 text-sm text-muted-foreground space-y-1">
        <p className="font-medium text-foreground">Privacy</p>
        <p>{PRIVACY_COPY}</p>
      </div>
    </div>
  );
}
