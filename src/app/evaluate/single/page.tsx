"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Play, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ModelSelector } from "@/components/model-selector";
import { RubricSelector } from "@/components/rubric-selector";
import { NoApiKeyBanner } from "@/components/no-api-key-banner";
import { EvaluationResult } from "@/components/evaluation-result";
import { useStore } from "@/lib/store";
import { getApiKeyHeaders, getDefaultModelId } from "@/lib/api-key-headers";
import { getBuiltInRubricById } from "@/lib/rubric-templates";
import { SINGLE_DEMO } from "@/lib/demo-data";
import type { SingleEvalResult } from "@/lib/types";

export default function SingleEvalPage() {
  const { settings, customRubrics, addResult } = useStore();

  const [modelId, setModelId] = useState(
    () => getDefaultModelId(settings.apiKeys) ?? settings.defaultModelId
  );
  const [rubricId, setRubricId] = useState(settings.defaultRubricId);
  const [prompt, setPrompt] = useState("");
  const [response, setResponse] = useState("");
  const [context, setContext] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SingleEvalResult | null>(null);

  function getRubric() {
    return (
      getBuiltInRubricById(rubricId) ??
      customRubrics.find((r) => r.id === rubricId)
    );
  }

  async function handleEvaluate() {
    if (!prompt.trim() || !response.trim()) {
      toast.error("Please fill in both the prompt and response fields.");
      return;
    }

    const rubric = getRubric();
    if (!rubric) {
      toast.error("Please select a valid rubric.");
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const headers = getApiKeyHeaders(modelId, settings.apiKeys);
      const res = await fetch("/api/evaluate/single", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({
          prompt,
          response,
          rubricId,
          rubric,
          modelId,
          context: context.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }

      const evalResult: SingleEvalResult = await res.json();
      setResult(evalResult);
      addResult(evalResult);
      toast.success("Evaluation complete!");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      toast.error(`Evaluation failed: ${msg}`);
    } finally {
      setLoading(false);
    }
  }

  function loadDemo() {
    setPrompt(SINGLE_DEMO.prompt);
    setResponse(SINGLE_DEMO.response);
    setContext(SINGLE_DEMO.context);
    setRubricId(SINGLE_DEMO.rubricId);
    setResult(null);
    toast.success("Demo loaded — click Evaluate to run it.");
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold tracking-tight">Single Evaluation</h2>
          <p className="text-sm text-muted-foreground">
            Score a single LLM response against a rubric using an LLM judge.
          </p>
        </div>
        <Button variant="outline" onClick={loadDemo} className="shrink-0 gap-1.5 btn-demo">
          <Sparkles className="h-3.5 w-3.5" />
          Load Demo
        </Button>
      </div>

      <NoApiKeyBanner />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input form */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Judge Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Judge Model</Label>
                <ModelSelector value={modelId} onValueChange={setModelId} />
              </div>
              <div className="space-y-2">
                <Label>Rubric</Label>
                <RubricSelector value={rubricId} onValueChange={setRubricId} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Evaluation Input</CardTitle>
              <CardDescription>
                Provide the original prompt and the LLM response to evaluate.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="prompt">Original Prompt</Label>
                <Textarea
                  id="prompt"
                  placeholder="What was the user's question or instruction?"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  rows={4}
                  className="resize-y"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="response">LLM Response to Evaluate</Label>
                <Textarea
                  id="response"
                  placeholder="Paste the LLM response you want to judge…"
                  value={response}
                  onChange={(e) => setResponse(e.target.value)}
                  rows={6}
                  className="resize-y"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="context">
                  Reference Context{" "}
                  <span className="text-muted-foreground font-normal">(optional)</span>
                </Label>
                <Textarea
                  id="context"
                  placeholder="Optional: system prompt, reference answer, or additional context for the judge…"
                  value={context}
                  onChange={(e) => setContext(e.target.value)}
                  rows={3}
                  className="resize-y"
                />
              </div>

              <Button
                onClick={handleEvaluate}
                disabled={loading || !prompt.trim() || !response.trim()}
                className="w-full"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Evaluating…
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-4 w-4" />
                    Evaluate
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Result panel */}
        <div>
          {result ? (
            <EvaluationResult result={result} />
          ) : (
            <Card className="h-full">
              <CardContent className="flex items-center justify-center h-full min-h-[400px]">
                <div className="text-center text-muted-foreground space-y-2">
                  <div className="text-4xl">📊</div>
                  <p className="font-medium">Results will appear here</p>
                  <p className="text-sm">
                    Fill in the form and click Evaluate to get started.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
