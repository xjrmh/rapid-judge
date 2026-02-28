"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeftRight,
  FlaskConical,
  History,
  Play,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RubricSelector } from "@/components/rubric-selector";
import { MODELS } from "@/lib/models";
import { useStore } from "@/lib/store";
import { formatCost, formatDate, formatTokens } from "@/lib/utils";
import type { ExperimentRun, RunComparison } from "@/lib/types";

interface DatasetSummary {
  id: string;
  name: string;
  latestVersionId: string;
  totalVersions: number;
}

interface DatasetVersionSummary {
  id: string;
  versionNumber: number;
  itemCount: number;
  createdAt: string;
  format: "csv" | "jsonl";
}

const DEFAULT_PROMPT_VERSION = {
  id: "judge-prompt",
  versionNumber: 1,
  createdAt: "2026-01-01T00:00:00.000Z",
  notes: "Structured JSON grading prompt v1",
};

const DEMO_RUBRIC_ID = "builtin-overall";

const EXPERIMENT_DEMO_JSONL = `{"prompt":"Explain RAG to a product manager in 3 bullets.","response":"RAG retrieves relevant documents before generation so responses are grounded.","task_type":"explanation","difficulty":"easy","language":"en"}
{"prompt":"Write a concise postmortem summary for an API outage.","response":"Summarize timeline, impact, root cause, fixes, and prevention actions.","task_type":"ops","difficulty":"medium","language":"en"}
{"prompt":"Propose 3 test cases for checkout discount logic.","response":"Include valid coupon, expired coupon, and stacked coupon rejection scenarios.","task_type":"qa","difficulty":"medium","language":"en"}`;

interface DatasetImportResponse {
  dataset: {
    id: string;
    name: string;
  };
  version: {
    id: string;
    versionNumber: number;
    itemCount: number;
  };
}

export default function ExperimentsPage() {
  const {
    settings,
    experimentRuns,
    history,
    addExperimentRun,
    getLatestRubricVersionRef,
  } = useStore();
  const [datasets, setDatasets] = useState<DatasetSummary[]>([]);
  const [versions, setVersions] = useState<DatasetVersionSummary[]>([]);
  const [remoteRuns, setRemoteRuns] = useState<ExperimentRun[]>([]);
  const [loadingRuns, setLoadingRuns] = useState(false);
  const [running, setRunning] = useState(false);
  const [comparing, setComparing] = useState(false);
  const [comparison, setComparison] = useState<RunComparison | null>(null);

  const [datasetId, setDatasetId] = useState("");
  const [datasetVersionId, setDatasetVersionId] = useState("");
  const [runName, setRunName] = useState("");
  const [evalMode, setEvalMode] = useState<"single" | "pairwise">("single");
  const [modelId, setModelId] = useState(settings.defaultModelId);
  const [rubricId, setRubricId] = useState(settings.defaultRubricId);
  const [repeats, setRepeats] = useState("1");

  const [baselineRunId, setBaselineRunId] = useState("");
  const [candidateRunId, setCandidateRunId] = useState("");

  async function fetchDatasets() {
    const res = await fetch("/api/datasets", { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as { datasets: DatasetSummary[] };
    setDatasets(data.datasets);
    if (!datasetId && data.datasets.length > 0) {
      setDatasetId(data.datasets[0].id);
    }
  }

  async function fetchVersions(id: string) {
    if (!id) return;
    const res = await fetch(`/api/datasets/${id}/versions`, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as { versions: DatasetVersionSummary[] };
    setVersions(data.versions);
    if (data.versions.length > 0) {
      setDatasetVersionId(data.versions[0].id);
    }
  }

  async function fetchRuns() {
    setLoadingRuns(true);
    try {
      const res = await fetch("/api/experiments/runs", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { runs: ExperimentRun[] };
      setRemoteRuns(data.runs);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      toast.error(`Failed to load experiment runs: ${message}`);
    } finally {
      setLoadingRuns(false);
    }
  }

  useEffect(() => {
    (async () => {
      try {
        await fetchDatasets();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        toast.error(`Failed to load datasets: ${message}`);
      }
      await fetchRuns();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!datasetId) return;
    (async () => {
      try {
        await fetchVersions(datasetId);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        toast.error(`Failed to load versions: ${message}`);
      }
    })();
  }, [datasetId]);

  const allRuns = useMemo(() => {
    const byId = new Map<string, ExperimentRun>();
    [...remoteRuns, ...experimentRuns].forEach((run) => byId.set(run.id, run));
    return [...byId.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [remoteRuns, experimentRuns]);

  async function handleRun() {
    if (!datasetId || !datasetVersionId || !rubricId || !modelId) {
      toast.error("Dataset, version, rubric, and model are required.");
      return;
    }

    setRunning(true);
    try {
      const repeatsNum = Math.max(1, Math.min(10, Number(repeats) || 1));
      const rubricVersionRef = getLatestRubricVersionRef(rubricId);

      const res = await fetch("/api/experiments/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: runName.trim() || undefined,
          datasetId,
          datasetVersionId,
          evalMode,
          judgeModelId: modelId,
          rubricId,
          repeats: repeatsNum,
          rubricVersionRef,
          judgePromptVersionRef: DEFAULT_PROMPT_VERSION,
          gates: {
            minMeanAggregateScore: 70,
            minPassRate: 0.6,
          },
        }),
      });
      const data = (await res.json()) as { run?: ExperimentRun; error?: string };
      if (!res.ok || !data.run) {
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }

      addExperimentRun(data.run);
      await fetchRuns();
      toast.success("Experiment run complete.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      toast.error(`Run failed: ${message}`);
    } finally {
      setRunning(false);
    }
  }

  async function handleCompare() {
    if (!baselineRunId || !candidateRunId) {
      toast.error("Select both baseline and candidate runs.");
      return;
    }
    if (baselineRunId === candidateRunId) {
      toast.error("Choose two different runs.");
      return;
    }

    setComparing(true);
    try {
      const res = await fetch("/api/experiments/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ baselineRunId, candidateRunId }),
      });
      const data = (await res.json()) as { comparison?: RunComparison; error?: string };
      if (!res.ok || !data.comparison) {
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      setComparison(data.comparison);
      toast.success("Run comparison complete.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      toast.error(`Compare failed: ${message}`);
    } finally {
      setComparing(false);
    }
  }

  async function loadDemo() {
    try {
      const res = await fetch("/api/datasets/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Experiment Demo Dataset",
          description: "Synthetic dataset for demo experiment runs.",
          format: "jsonl",
          content: EXPERIMENT_DEMO_JSONL,
          tags: ["demo", "experiments"],
        }),
      });

      const data = (await res.json()) as
        | DatasetImportResponse
        | { error?: string; issues?: string[] };
      if (!res.ok) {
        const err = data as { error?: string; issues?: string[] };
        const issue = err.issues?.[0];
        throw new Error(issue ?? err.error ?? `HTTP ${res.status}`);
      }

      const imported = data as DatasetImportResponse;

      setDatasetId(imported.dataset.id);
      setDatasetVersionId(imported.version.id);
      setRunName("Demo Experiment Run");
      setEvalMode("single");
      setModelId(settings.defaultModelId);
      setRubricId(DEMO_RUBRIC_ID);
      setRepeats("2");
      setComparison(null);
      setBaselineRunId("");
      setCandidateRunId("");

      await fetchDatasets();
      await fetchVersions(imported.dataset.id);

      toast.success(
        `Demo loaded — dataset "${imported.dataset.name}" v${imported.version.versionNumber} ready. Click Run Experiment.`
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      toast.error(`Failed to load demo: ${message}`);
    }
  }

  return (
    <div className="tab-page">
      <div className="flex items-start justify-between gap-4">
        <div className="tab-header">
          <h1 className="tab-title">Experiments</h1>
          <p className="tab-subtitle">
            Configure dataset-pinned runs, compare deltas, and monitor regressions.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => void loadDemo()}
          className="shrink-0 gap-1.5 btn-demo"
        >
          <Sparkles className="h-3.5 w-3.5" />
          Load Demo
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Run Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Run Name</Label>
              <Input
                value={runName}
                onChange={(e) => setRunName(e.target.value)}
                placeholder="e.g. v3 prompt rollout"
              />
            </div>
            <div className="space-y-2">
              <Label>Dataset</Label>
              <Select value={datasetId} onValueChange={setDatasetId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select dataset" />
                </SelectTrigger>
                <SelectContent>
                  {datasets.map((dataset) => (
                    <SelectItem key={dataset.id} value={dataset.id}>
                      {dataset.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Dataset Version</Label>
              <Select value={datasetVersionId} onValueChange={setDatasetVersionId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select version" />
                </SelectTrigger>
                <SelectContent>
                  {versions.map((version) => (
                    <SelectItem key={version.id} value={version.id}>
                      v{version.versionNumber} · {version.itemCount} rows
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Evaluation Mode</Label>
              <Select value={evalMode} onValueChange={(value) => setEvalMode(value as "single" | "pairwise")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="single">Single</SelectItem>
                  <SelectItem value="pairwise">Pairwise</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Judge Model</Label>
              <Select value={modelId} onValueChange={setModelId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MODELS.map((model) => (
                    <SelectItem key={model.id} value={model.id}>
                      {model.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Rubric</Label>
              <RubricSelector value={rubricId} onValueChange={setRubricId} />
            </div>
            <div className="space-y-2">
              <Label>Repeats</Label>
              <Input
                type="number"
                min={1}
                max={10}
                value={repeats}
                onChange={(e) => setRepeats(e.target.value)}
              />
            </div>
            <Button onClick={handleRun} disabled={running} className="w-full gap-2">
              <Play className="h-4 w-4" />
              {running ? "Running..." : "Run Experiment"}
            </Button>
          </CardContent>
        </Card>

        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <div>
                <CardTitle className="text-base">Run History</CardTitle>
                <CardDescription>
                  {allRuns.length} run{allRuns.length === 1 ? "" : "s"} available
                </CardDescription>
              </div>
              <CardAction>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void fetchRuns()}
                  disabled={loadingRuns}
                >
                  <RefreshCw className="h-4 w-4 mr-1.5" />
                  Refresh
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent className="space-y-2">
              {allRuns.length === 0 ? (
                <div className="rounded-md border border-dashed p-8 text-center text-muted-foreground">
                  <FlaskConical className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  No runs yet.
                </div>
              ) : (
                allRuns.slice(0, 12).map((run) => (
                  <div key={run.id} className="rounded-md border p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm">{run.config.name ?? run.id}</p>
                        <Badge variant="outline">{run.runType}</Badge>
                        <Badge variant="secondary">{run.config.evalMode}</Badge>
                        {run.rubricVersionRef && (
                          <Badge variant="outline">
                            rubric v{run.rubricVersionRef.versionNumber}
                          </Badge>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">{formatDate(run.createdAt)}</span>
                    </div>
                    <div className="mt-2 grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
                      <div>Score: <strong>{run.metrics.meanAggregateScore.toFixed(1)}</strong></div>
                      <div>Pass: <strong>{(run.metrics.passRate * 100).toFixed(1)}%</strong></div>
                      <div>Cases: <strong>{run.metrics.caseCount}</strong></div>
                      <div>Tokens: <strong>{formatTokens(run.metrics.inputTokens + run.metrics.outputTokens)}</strong></div>
                      <div>Cost: <strong>{formatCost(run.metrics.estimatedCostUsd)}</strong></div>
                    </div>
                    {run.regression && !run.regression.passed && (
                      <p className="text-xs text-red-600 mt-2">{run.regression.reasons.join(" ")}</p>
                    )}
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <ArrowLeftRight className="h-4 w-4" />
                Compare Runs
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Baseline</Label>
                  <Select value={baselineRunId} onValueChange={setBaselineRunId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select baseline run" />
                    </SelectTrigger>
                    <SelectContent>
                      {allRuns.map((run) => (
                        <SelectItem key={run.id} value={run.id}>
                          {truncateRunLabel(run)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Candidate</Label>
                  <Select value={candidateRunId} onValueChange={setCandidateRunId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select candidate run" />
                    </SelectTrigger>
                    <SelectContent>
                      {allRuns.map((run) => (
                        <SelectItem key={run.id} value={run.id}>
                          {truncateRunLabel(run)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button onClick={handleCompare} disabled={comparing || allRuns.length < 2}>
                {comparing ? "Comparing..." : "Run Comparison"}
              </Button>

              {comparison && (
                <div className="rounded-md border p-3 space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Badge variant={comparison.verdict === "improved" ? "default" : "secondary"}>
                      {comparison.verdict}
                    </Badge>
                    {!comparison.compatible && (
                      <Badge variant="outline" className="border-amber-200 text-amber-700">
                        compatibility warning
                      </Badge>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                    <p>Score Δ: <strong>{signed(comparison.deltas.meanAggregateScore)}</strong></p>
                    <p>Pass Δ: <strong>{signed((comparison.deltas.passRate * 100).toFixed(2))}%</strong></p>
                    <p>Cost Δ: <strong>{signed(formatCost(comparison.deltas.estimatedCostUsd))}</strong></p>
                  </div>
                  {comparison.warnings.length > 0 && (
                    <ul className="text-xs text-amber-700 list-disc pl-4 space-y-1">
                      {comparison.warnings.map((warning) => (
                        <li key={warning}>{warning}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <History className="h-4 w-4" />
                Recent Ad-hoc Activity
              </CardTitle>
              <CardDescription>
                Projection of quick Evaluate runs now tracked inside the experiment lifecycle.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {history.length === 0 ? (
                <p className="text-sm text-muted-foreground">No ad-hoc evaluations yet.</p>
              ) : (
                history.slice(0, 6).map((result) => (
                  <div key={result.id} className="rounded-md border px-3 py-2 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{result.mode}</Badge>
                        <span className="font-medium">{result.rubric.name}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">{formatDate(result.createdAt)}</span>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function signed(value: string | number): string {
  const raw = typeof value === "number" ? value.toString() : value;
  if (raw.startsWith("-")) return raw;
  return `+${raw}`;
}

function truncateRunLabel(run: ExperimentRun): string {
  const name = run.config.name ?? run.id;
  return `${name.slice(0, 28)}${name.length > 28 ? "..." : ""} (${run.config.evalMode})`;
}
