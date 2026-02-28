"use client";

import { AlertTriangle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useStore } from "@/lib/store";
import { hasAnyApiKey } from "@/lib/api-key-headers";

export function NoApiKeyBanner() {
  const { settings } = useStore();

  if (hasAnyApiKey(settings?.apiKeys ?? {})) return null;

  return (
    <Alert variant="destructive" className="border-yellow-200 bg-yellow-50 text-yellow-800">
      <AlertTriangle className="h-4 w-4 text-yellow-600" />
      <AlertDescription>
        No API key configured. Go to the{" "}
        <strong>Settings</strong> tab in the nav to add a key for OpenAI, Anthropic, or Google.
      </AlertDescription>
    </Alert>
  );
}
