"use client";

import { AlertTriangle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useStore } from "@/lib/store";
import { hasAnyApiKey } from "@/lib/api-key-headers";

export function NoApiKeyBanner() {
  const { settings } = useStore();

  if (hasAnyApiKey(settings?.apiKeys ?? {})) return null;

  return (
    <Alert className="border-amber-300 bg-amber-50 text-amber-900">
      <AlertTriangle className="h-4 w-4 text-amber-700" />
      <AlertDescription>
        The app is in demo mode as no API key configured. Go to the Settings tab to add a key for OpenAI, Anthropic, or Google.
      </AlertDescription>
    </Alert>
  );
}
