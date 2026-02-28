"use client";

import { useState } from "react";
import { Settings, Eye, EyeOff, X } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useStore } from "@/lib/store";
import { PRIVACY_COPY } from "@/lib/privacy-copy";

function ApiKeyField({
  label,
  provider,
  placeholder,
}: {
  label: string;
  provider: "openai" | "anthropic" | "google";
  placeholder: string;
}) {
  const { settings, updateApiKey } = useStore();
  const [show, setShow] = useState(false);
  const value = settings?.apiKeys?.[provider] ?? "";

  return (
    <div className="space-y-2">
      <Label htmlFor={`key-${provider}`} className="text-sm font-medium">
        {label}
      </Label>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Input
            id={`key-${provider}`}
            type={show ? "text" : "password"}
            value={value}
            onChange={(e) => updateApiKey(provider, e.target.value)}
            placeholder={placeholder}
            className="pr-10 font-mono text-xs"
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
      {value && (
        <p className="text-xs text-green-600">
          ✓ Key configured ({value.slice(0, 8)}…)
        </p>
      )}
    </div>
  );
}

export function SettingsSheet() {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" title="Settings">
          <Settings className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[400px] sm:w-[480px]">
        <SheetHeader>
          <SheetTitle>Settings</SheetTitle>
          <SheetDescription>
            Configure your API keys to use Rapid Judge.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
              API Keys
            </h3>
            <div className="space-y-5">
              <ApiKeyField
                label="OpenAI"
                provider="openai"
                placeholder="sk-..."
              />
              <Separator />
              <ApiKeyField
                label="Anthropic"
                provider="anthropic"
                placeholder="sk-ant-..."
              />
              <Separator />
              <ApiKeyField
                label="Google AI"
                provider="google"
                placeholder="AIza..."
              />
            </div>
          </div>

          <Separator />

          <div className="rounded-md bg-muted p-3 text-xs text-muted-foreground space-y-1">
            <p className="font-medium text-foreground">Privacy Note</p>
            <p>{PRIVACY_COPY}</p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
