"use client";

import { useState, useRef } from "react";
import { toast } from "sonner";
import Papa from "papaparse";
import { Upload, Play, Download, Loader2, CheckCircle, XCircle, Clock, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ModelSelector } from "@/components/model-selector";
import { RubricSelector } from "@/components/rubric-selector";
import { NoApiKeyBanner } from "@/components/no-api-key-banner";
import { AggregateScoreBadge } from "@/components/score-badge";
import { useStore } from "@/lib/store";
import { getApiKeyHeaders, getDefaultModelId } from "@/lib/api-key-headers";
import { getBuiltInRubricById } from "@/lib/rubric-templates";
import { truncate } from "@/lib/utils";
import { BATCH_DEMO_ROWS } from "@/lib/demo-data";
import type { EvalResult, BatchRowStatus, EvaluationMode } from "@/lib/types";

interface BatchRow {
  index: number;
  mode: EvaluationMode;
  prompt: string;
  response?: string;
  responseA?: string;
  responseB?: string;
  context?: string;
  status: BatchRowStatus;
  result?: EvalResult;
  error?: string;
}

function StatusIcon({ status }: { status: BatchRowStatus }) {
  switch (status) {
    case "done":
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    case "error":
      return <XCircle className="h-4 w-4 text-red-500" />;
    case "running":
      return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
    default:
      return <Clock className="h-4 w-4 text-muted-foreground" />;
  }
}

function RowResultPreview({ result }: { result: EvalResult }) {
  if (result.mode === "single") {
    return (
      <AggregateScoreBadge score={result.aggregateScore} size="sm" />
    );
  }
  const winner =
    result.verdict === "tie"
      ? "Tie"
      : result.verdict === "A"
        ? "A wins"
        : "B wins";
  return (
    <Badge
      variant="outline"
      className={
        result.verdict === "A"
          ? "border-green-200 text-green-700"
          : result.verdict === "B"
            ? "border-blue-200 text-blue-700"
            : ""
      }
    >
      {winner}
    </Badge>
  );
}

export default function BatchPage() {
  const { settings, customRubrics } = useStore();

  const [modelId, setModelId] = useState(
    () => getDefaultModelId(settings.apiKeys) ?? settings.defaultModelId
  );
  const [rubricId, setRubricId] = useState(settings.defaultRubricId);
  const [rows, setRows] = useState<BatchRow[]>([]);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef(false);

  function getRubric() {
    return (
      getBuiltInRubricById(rubricId) ??
      customRubrics.find((r) => r.id === rubricId)
    );
  }

  function handleFileUpload(file: File) {
    if (!file) return;
    const isJsonl = file.name.endsWith(".jsonl") || file.name.endsWith(".ndjson");

    if (isJsonl) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        const parsed = text
          .split("\n")
          .filter((l) => l.trim())
          .map((line, i) => {
            try {
              return { index: i, ...JSON.parse(line) };
            } catch {
              return null;
            }
          })
          .filter(Boolean) as Record<string, unknown>[];

        setRows(convertToRows(parsed));
        setDone(false);
        toast.success(`Loaded ${parsed.length} rows from JSONL.`);
      };
      reader.readAsText(file);
    } else {
      // CSV
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (result) => {
          setRows(convertToRows(result.data as Record<string, unknown>[]));
          setDone(false);
          toast.success(`Loaded ${result.data.length} rows from CSV.`);
        },
        error: (err) => {
          toast.error(`CSV parse error: ${err.message}`);
        },
      });
    }
  }

  function convertToRows(data: Record<string, unknown>[]): BatchRow[] {
    return data.map((row, i) => {
      const hasResponseA = "responseA" in row || "response_a" in row;
      const mode: EvaluationMode = hasResponseA ? "pairwise" : "single";

      return {
        index: i,
        mode,
        prompt: String(row.prompt ?? ""),
        response: row.response ? String(row.response) : undefined,
        responseA:
          row.responseA || row.response_a
            ? String(row.responseA ?? row.response_a ?? "")
            : undefined,
        responseB:
          row.responseB || row.response_b
            ? String(row.responseB ?? row.response_b ?? "")
            : undefined,
        context: row.context ? String(row.context) : undefined,
        status: "pending",
      };
    });
  }

  async function handleRun() {
    const rubric = getRubric();
    if (!rubric) {
      toast.error("Please select a valid rubric.");
      return;
    }
    if (rows.length === 0) {
      toast.error("No rows to evaluate. Upload a file first.");
      return;
    }

    setRunning(true);
    setDone(false);
    abortRef.current = false;

    // Reset all rows to pending
    setRows((prev) => prev.map((r) => ({ ...r, status: "pending", result: undefined, error: undefined })));

    const headers = getApiKeyHeaders(modelId, settings.apiKeys);

    for (let i = 0; i < rows.length; i++) {
      if (abortRef.current) break;

      const row = rows[i];

      // Mark running
      setRows((prev) =>
        prev.map((r, idx) => (idx === i ? { ...r, status: "running" } : r))
      );

      try {
        const body: Record<string, unknown> = {
          mode: row.mode,
          prompt: row.prompt,
          rubricId: rubric.id,
          rubric,
          modelId,
          context: row.context,
        };

        if (row.mode === "single") {
          body.response = row.response;
        } else {
          body.responseA = row.responseA;
          body.responseB = row.responseB;
        }

        const res = await fetch("/api/evaluate/batch", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...headers },
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error ?? `HTTP ${res.status}`);
        }

        const result: EvalResult = await res.json();

        setRows((prev) =>
          prev.map((r, idx) =>
            idx === i ? { ...r, status: "done", result } : r
          )
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        setRows((prev) =>
          prev.map((r, idx) =>
            idx === i ? { ...r, status: "error", error: msg } : r
          )
        );
      }
    }

    setRunning(false);
    setDone(true);
    toast.success("Batch evaluation complete!");
  }

  function handleDownload() {
    const csvRows = rows.map((row) => {
      const base: Record<string, unknown> = {
        index: row.index,
        mode: row.mode,
        prompt: row.prompt,
        status: row.status,
      };

      if (row.mode === "single") {
        base.response = row.response;
        if (row.result?.mode === "single") {
          base.aggregate_score = row.result.aggregateScore;
          base.cost_usd = row.result.estimatedCostUsd;
        }
      } else {
        base.responseA = row.responseA;
        base.responseB = row.responseB;
        if (row.result?.mode === "pairwise") {
          base.aggregate_score_A = row.result.aggregateScoreA;
          base.aggregate_score_B = row.result.aggregateScoreB;
          base.verdict = row.result.verdict;
          base.cost_usd = row.result.estimatedCostUsd;
        }
      }

      if (row.error) base.error = row.error;
      return base;
    });

    const csv = Papa.unparse(csvRows);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rapid-judge-batch-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function loadDemo() {
    const demoRows: BatchRow[] = BATCH_DEMO_ROWS.map((row, i) => ({
      index: i,
      mode: ("responseA" in row ? "pairwise" : "single") as EvaluationMode,
      prompt: row.prompt,
      response: row.response,
      responseA: row.responseA,
      responseB: row.responseB,
      context: row.context,
      status: "pending",
    }));
    setRows(demoRows);
    setDone(false);
    toast.success(`Demo loaded — ${demoRows.length} rows ready. Click Run Batch to evaluate.`);
  }

  const completed = rows.filter((r) => r.status === "done" || r.status === "error").length;
  const progress = rows.length > 0 ? (completed / rows.length) * 100 : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Batch Evaluation</h1>
          <p className="text-muted-foreground mt-1">
            Upload a CSV or JSONL file to evaluate multiple responses at once.
          </p>
        </div>
        <Button variant="outline" onClick={loadDemo} className="shrink-0 gap-1.5">
          <Sparkles className="h-3.5 w-3.5" />
          Load Demo
        </Button>
      </div>

      <NoApiKeyBanner />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Config */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Configuration</CardTitle>
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
              <CardTitle className="text-base">Upload File</CardTitle>
              <CardDescription className="text-xs space-y-1">
                <p>
                  <strong>CSV columns (single):</strong> prompt, response,
                  context (optional)
                </p>
                <p>
                  <strong>CSV columns (pairwise):</strong> prompt, responseA,
                  responseB, context (optional)
                </p>
                <p>JSONL: one JSON object per line with same fields.</p>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.jsonl,.ndjson"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileUpload(file);
                }}
              />
              <Button
                variant="outline"
                className="w-full gap-2"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-4 w-4" />
                Choose File
              </Button>

              {rows.length > 0 && (
                <p className="text-sm text-center text-muted-foreground">
                  {rows.length} rows loaded ({rows.filter((r) => r.mode === "pairwise").length} pairwise,{" "}
                  {rows.filter((r) => r.mode === "single").length} single)
                </p>
              )}
            </CardContent>
          </Card>

          <div className="space-y-2">
            <Button
              onClick={handleRun}
              disabled={running || rows.length === 0}
              className="w-full gap-2"
            >
              {running ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Running… ({completed}/{rows.length})
                </>
              ) : (
                <>
                  <Play className="h-4 w-4" />
                  Run Batch
                </>
              )}
            </Button>

            {done && (
              <Button
                variant="outline"
                className="w-full gap-2"
                onClick={handleDownload}
              >
                <Download className="h-4 w-4" />
                Download Results CSV
              </Button>
            )}
          </div>
        </div>

        {/* Results table */}
        <div className="lg:col-span-2 space-y-4">
          {running && (
            <div className="space-y-2">
              <Progress value={progress} className="h-2" />
              <p className="text-xs text-muted-foreground text-right">
                {completed} / {rows.length} complete
              </p>
            </div>
          )}

          {rows.length === 0 ? (
            <Card
              className="cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <CardContent className="flex items-center justify-center min-h-[300px]">
                <div className="text-center text-muted-foreground space-y-3">
                  <Upload className="h-10 w-10 mx-auto opacity-30" />
                  <p className="font-medium">Drop a CSV or JSONL file here</p>
                  <p className="text-sm">
                    Or click to browse. See the format instructions on the left.
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-3 font-medium w-10">#</th>
                    <th className="text-left p-3 font-medium">Prompt</th>
                    <th className="text-left p-3 font-medium w-16">Mode</th>
                    <th className="text-left p-3 font-medium w-20">Status</th>
                    <th className="text-left p-3 font-medium w-28">Score</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.index} className="border-t hover:bg-muted/20">
                      <td className="p-3 text-muted-foreground">{row.index + 1}</td>
                      <td className="p-3">
                        <span className="line-clamp-1">
                          {truncate(row.prompt, 60)}
                        </span>
                        {row.error && (
                          <p className="text-xs text-red-500 mt-0.5">
                            {row.error}
                          </p>
                        )}
                      </td>
                      <td className="p-3">
                        <Badge variant="outline" className="text-xs">
                          {row.mode}
                        </Badge>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-1.5">
                          <StatusIcon status={row.status} />
                          <span className="text-xs capitalize">{row.status}</span>
                        </div>
                      </td>
                      <td className="p-3">
                        {row.result && <RowResultPreview result={row.result} />}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
