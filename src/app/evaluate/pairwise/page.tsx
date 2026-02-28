"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Play, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { ModelSelector } from "@/components/model-selector";
import { RubricSelector } from "@/components/rubric-selector";
import { NoApiKeyBanner } from "@/components/no-api-key-banner";
import { EvaluationResult } from "@/components/evaluation-result";
import { useStore } from "@/lib/store";
import { getApiKeyHeaders, getDefaultModelId } from "@/lib/api-key-headers";
import { getBuiltInRubricById } from "@/lib/rubric-templates";
import { PAIRWISE_DEMO } from "@/lib/demo-data";
import type { PairwiseEvalResult } from "@/lib/types";

export default function PairwisePage() {
  const { settings, customRubrics, addResult } = useStore();

  const [modelId, setModelId] = useState(
    () => getDefaultModelId(settings.apiKeys) ?? settings.defaultModelId
  );
  const [rubricId, setRubricId] = useState(settings.defaultRubricId);
  const [prompt, setPrompt] = useState("");
  const [responseA, setResponseA] = useState("");
  const [responseB, setResponseB] = useState("");
  const [labelA, setLabelA] = useState("");
  const [labelB, setLabelB] = useState("");
  const [context, setContext] = useState("");
  const [doubleBlind, setDoubleBlind] = useState(true);
  const [detectBias, setDetectBias] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PairwiseEvalResult | null>(null);

  function getRubric() {
    return (
      getBuiltInRubricById(rubricId) ??
      customRubrics.find((r) => r.id === rubricId)
    );
  }

  async function handleEvaluate() {
    if (!prompt.trim() || !responseA.trim() || !responseB.trim()) {
      toast.error("Please fill in the prompt and both responses.");
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
      const res = await fetch("/api/evaluate/pairwise", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({
          prompt,
          responseA,
          responseB,
          modelLabelA: labelA.trim() || undefined,
          modelLabelB: labelB.trim() || undefined,
          rubricId,
          rubric,
          modelId,
          doubleBlind,
          detectPositionBias: detectBias,
          context: context.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }

      const evalResult: PairwiseEvalResult = await res.json();
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
    setPrompt(PAIRWISE_DEMO.prompt);
    setResponseA(PAIRWISE_DEMO.responseA);
    setResponseB(PAIRWISE_DEMO.responseB);
    setLabelA(PAIRWISE_DEMO.labelA);
    setLabelB(PAIRWISE_DEMO.labelB);
    setContext(PAIRWISE_DEMO.context);
    setDoubleBlind(false);
    setResult(null);
    toast.success("Demo loaded — click Compare to run it.");
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Pairwise Comparison</h1>
          <p className="text-muted-foreground mt-1">
            Compare two LLM responses head-to-head and determine which is better.
          </p>
        </div>
        <Button variant="outline" onClick={loadDemo} className="shrink-0 gap-1.5">
          <Sparkles className="h-3.5 w-3.5" />
          Load Demo
        </Button>
      </div>

      <NoApiKeyBanner />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input */}
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

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Double-Blind Mode</p>
                  <p className="text-xs text-muted-foreground">
                    Hide model labels from the judge
                  </p>
                </div>
                <Switch checked={doubleBlind} onCheckedChange={setDoubleBlind} />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Detect Position Bias</p>
                  <p className="text-xs text-muted-foreground">
                    Run evaluation in both orders (2× cost)
                  </p>
                </div>
                <Switch checked={detectBias} onCheckedChange={setDetectBias} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Prompt</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="prompt">Original Prompt</Label>
                <Textarea
                  id="prompt"
                  placeholder="The prompt that was given to both models…"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  rows={3}
                  className="resize-y"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="context">
                  Context{" "}
                  <span className="text-muted-foreground font-normal">(optional)</span>
                </Label>
                <Textarea
                  id="context"
                  placeholder="Optional reference answer or system context…"
                  value={context}
                  onChange={(e) => setContext(e.target.value)}
                  rows={2}
                  className="resize-y"
                />
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Response A</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {!doubleBlind && (
                  <Input
                    placeholder="Model name (optional)"
                    value={labelA}
                    onChange={(e) => setLabelA(e.target.value)}
                    className="text-sm"
                  />
                )}
                <Textarea
                  placeholder="Paste Response A here…"
                  value={responseA}
                  onChange={(e) => setResponseA(e.target.value)}
                  rows={6}
                  className="resize-y text-sm"
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Response B</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {!doubleBlind && (
                  <Input
                    placeholder="Model name (optional)"
                    value={labelB}
                    onChange={(e) => setLabelB(e.target.value)}
                    className="text-sm"
                  />
                )}
                <Textarea
                  placeholder="Paste Response B here…"
                  value={responseB}
                  onChange={(e) => setResponseB(e.target.value)}
                  rows={6}
                  className="resize-y text-sm"
                />
              </CardContent>
            </Card>
          </div>

          <Button
            onClick={handleEvaluate}
            disabled={
              loading ||
              !prompt.trim() ||
              !responseA.trim() ||
              !responseB.trim()
            }
            className="w-full"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {detectBias ? "Running 2 evaluations…" : "Evaluating…"}
              </>
            ) : (
              <>
                <Play className="mr-2 h-4 w-4" />
                Compare
              </>
            )}
          </Button>
        </div>

        {/* Result */}
        <div>
          {result ? (
            <EvaluationResult result={result} />
          ) : (
            <Card className="h-full">
              <CardContent className="flex items-center justify-center h-full min-h-[400px]">
                <div className="text-center text-muted-foreground space-y-2">
                  <div className="text-4xl">⚖️</div>
                  <p className="font-medium">Comparison results will appear here</p>
                  <p className="text-sm">
                    Enter two responses and click Compare.
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
