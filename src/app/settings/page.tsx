"use client";

import { useState } from "react";
import { Eye, EyeOff, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useStore } from "@/lib/store";

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
  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-1">
          Configure your API keys. You only need keys for the providers you want to use as judges.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">API Keys</CardTitle>
          <CardDescription>
            Keys are stored only in your browser&apos;s localStorage and sent directly to
            the provider — never to our servers.
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

      <div className="rounded-md bg-muted/50 border p-4 text-sm text-muted-foreground space-y-1">
        <p className="font-medium text-foreground">Privacy</p>
        <p>
          Your API keys never leave your browser. All evaluation requests are proxied through
          the Next.js API route on this server, which reads your key from the request header
          and forwards it to the LLM provider. The key is never logged or stored server-side.
        </p>
      </div>
    </div>
  );
}
