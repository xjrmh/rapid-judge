"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Database, FileUp, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { formatDate, truncate } from "@/lib/utils";

interface DatasetSummary {
  id: string;
  name: string;
  description?: string;
  updatedAt: string;
  latestVersionId: string;
  totalVersions: number;
  tags: string[];
  latestVersion?: {
    id: string;
    versionNumber: number;
    itemCount: number;
    createdAt: string;
    format: "csv" | "jsonl";
    hash: string;
  };
}

interface DatasetVersionSummary {
  id: string;
  datasetId: string;
  versionNumber: number;
  createdAt: string;
  format: "csv" | "jsonl";
  hash: string;
  itemCount: number;
  slices: Array<{
    id: string;
    label: string;
    value: string;
    itemCount: number;
  }>;
}

const DEMO_JSONL = `{"prompt":"Explain API rate limiting in one paragraph.","response":"Rate limiting caps requests over a time window to protect reliability.","tags":"docs,backend","task_type":"explanation","difficulty":"easy","language":"en"}
{"prompt":"Summarize CAP theorem for architects.","responseA":"CAP says pick two properties.","responseB":"Under partition, choose consistency or availability.","mode":"pairwise","task_type":"architecture","difficulty":"medium","language":"en","gold_verdict":"B"}`;

export default function DatasetsPage() {
  const [datasets, setDatasets] = useState<DatasetSummary[]>([]);
  const [selectedDatasetId, setSelectedDatasetId] = useState<string>("");
  const [versions, setVersions] = useState<DatasetVersionSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [format, setFormat] = useState<"csv" | "jsonl">("jsonl");
  const [tags, setTags] = useState("");
  const [content, setContent] = useState(DEMO_JSONL);
  const [issues, setIssues] = useState<string[]>([]);

  async function fetchDatasets() {
    setLoading(true);
    try {
      const res = await fetch("/api/datasets", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { datasets: DatasetSummary[] };
      setDatasets(data.datasets);
      if (!selectedDatasetId && data.datasets.length > 0) {
        setSelectedDatasetId(data.datasets[0].id);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      toast.error(`Failed to load datasets: ${message}`);
    } finally {
      setLoading(false);
    }
  }

  async function fetchVersions(datasetId: string) {
    if (!datasetId) return;
    try {
      const res = await fetch(`/api/datasets/${datasetId}/versions`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { versions: DatasetVersionSummary[] };
      setVersions(data.versions);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      toast.error(`Failed to load versions: ${message}`);
    }
  }

  useEffect(() => {
    void fetchDatasets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedDatasetId) return;
    void fetchVersions(selectedDatasetId);
  }, [selectedDatasetId]);

  async function handleImport() {
    if (!name.trim() || !content.trim()) {
      toast.error("Dataset name and content are required.");
      return;
    }

    setImporting(true);
    setIssues([]);
    try {
      const res = await fetch("/api/datasets/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
          format,
          content,
          tags: tags
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean),
        }),
      });

      const data = (await res.json()) as
        | { dataset: DatasetSummary; version: DatasetVersionSummary }
        | { error: string; issues?: string[] };

      if (!res.ok) {
        const err = data as { error: string; issues?: string[] };
        setIssues(err.issues ?? []);
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }

      const success = data as { dataset: DatasetSummary; version: DatasetVersionSummary };
      toast.success(
        `Imported ${success.version.itemCount} rows into ${success.dataset.name} v${success.version.versionNumber}.`
      );
      setSelectedDatasetId(success.dataset.id);
      await fetchDatasets();
      await fetchVersions(success.dataset.id);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      toast.error(`Import failed: ${message}`);
    } finally {
      setImporting(false);
    }
  }

  const selectedDataset = useMemo(
    () => datasets.find((dataset) => dataset.id === selectedDatasetId),
    [datasets, selectedDatasetId]
  );

  return (
    <div className="tab-page">
      <div className="tab-header">
        <h1 className="tab-title">Datasets</h1>
        <p className="tab-subtitle">
          Build immutable dataset versions, tag slices, and pin versions for reproducible runs.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Import Dataset Version</CardTitle>
            <CardDescription>
              Supports CSV and JSONL with `prompt` plus either `response` or `responseA/responseB`.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Dataset Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Helpdesk QA set" />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                placeholder="What this dataset evaluates."
              />
            </div>
            <div className="space-y-2">
              <Label>Format</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={format === "jsonl" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFormat("jsonl")}
                >
                  JSONL
                </Button>
                <Button
                  type="button"
                  variant={format === "csv" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFormat("csv")}
                >
                  CSV
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Dataset Tags</Label>
              <Input
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="support,english,production"
              />
            </div>
            <div className="space-y-2">
              <Label>Raw Content</Label>
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={10}
                className="font-mono text-xs"
              />
            </div>
            {issues.length > 0 && (
              <div className="rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-800 space-y-1">
                <p className="font-semibold">Validation issues ({issues.length})</p>
                {issues.slice(0, 8).map((issue, idx) => (
                  <p key={`${issue}-${idx}`}>{issue}</p>
                ))}
                {issues.length > 8 && <p>...and {issues.length - 8} more</p>}
              </div>
            )}
            <Button onClick={handleImport} disabled={importing} className="w-full gap-2">
              <FileUp className="h-4 w-4" />
              {importing ? "Importing..." : "Import New Version"}
            </Button>
          </CardContent>
        </Card>

        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <div>
                <CardTitle className="text-base">Dataset Registry</CardTitle>
                <CardDescription>
                  {datasets.length} dataset{datasets.length === 1 ? "" : "s"} available
                </CardDescription>
              </div>
              <CardAction>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void fetchDatasets()}
                  disabled={loading}
                >
                  <RefreshCw className="h-4 w-4 mr-1.5" />
                  Refresh
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent className="space-y-3">
              {datasets.length === 0 ? (
                <div className="rounded-md border border-dashed p-8 text-center text-muted-foreground">
                  <Database className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  No datasets imported yet.
                </div>
              ) : (
                datasets.map((dataset) => (
                  <button
                    key={dataset.id}
                    onClick={() => setSelectedDatasetId(dataset.id)}
                    className={`w-full rounded-md border px-3 py-2 text-left transition-colors ${
                      dataset.id === selectedDatasetId ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium">{dataset.name}</p>
                      <Badge variant="outline">v{dataset.latestVersion?.versionNumber ?? dataset.totalVersions}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {dataset.description ? truncate(dataset.description, 120) : "No description"}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {(dataset.tags ?? []).slice(0, 6).map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-[10px]">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </button>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {selectedDataset ? `${selectedDataset.name} Versions` : "Version History"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {versions.length === 0 ? (
                <p className="text-sm text-muted-foreground">Select a dataset to inspect versions.</p>
              ) : (
                versions.map((version) => (
                  <div key={version.id} className="rounded-md border p-3 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">v{version.versionNumber}</Badge>
                        <Badge variant="secondary">{version.format.toUpperCase()}</Badge>
                        <span className="text-xs text-muted-foreground">{version.itemCount} items</span>
                      </div>
                      <span className="text-xs text-muted-foreground">{formatDate(version.createdAt)}</span>
                    </div>
                    {version.slices.length > 0 && (
                      <>
                        <Separator />
                        <div className="flex flex-wrap gap-1">
                          {version.slices.map((slice) => (
                            <Badge key={slice.id} variant="outline" className="text-[10px]">
                              {slice.label}:{slice.value} ({slice.itemCount})
                            </Badge>
                          ))}
                        </div>
                      </>
                    )}
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
