"use client";

import { useState } from "react";
import { Trash2, ChevronDown, ChevronUp, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EvaluationResult } from "@/components/evaluation-result";
import { AggregateScoreBadge } from "@/components/score-badge";
import { useStore } from "@/lib/store";
import { formatDate, formatCost, truncate } from "@/lib/utils";
import type { EvalResult, PairwiseEvalResult } from "@/lib/types";

function VerdictBadge({ result }: { result: EvalResult }) {
  if (result.mode === "single") {
    return <AggregateScoreBadge score={result.aggregateScore} size="sm" />;
  }

  const r = result as PairwiseEvalResult;
  const label =
    r.verdict === "A" ? "A wins" : r.verdict === "B" ? "B wins" : "Tie";
  const className =
    r.verdict === "A"
      ? "border-green-200 text-green-700 bg-green-50"
      : r.verdict === "B"
        ? "border-blue-200 text-blue-700 bg-blue-50"
        : "";

  return (
    <Badge variant="outline" className={`text-xs ${className}`}>
      {label}
    </Badge>
  );
}

function HistoryRow({ result }: { result: EvalResult }) {
  const [expanded, setExpanded] = useState(false);
  const { removeResult } = useStore();

  return (
    <div className="border-b last:border-0">
      <div
        className="flex items-center gap-3 p-3 hover:bg-muted/30 cursor-pointer"
        onClick={() => setExpanded((e) => !e)}
      >
        <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-4 gap-1 sm:gap-3 items-center">
          <div className="text-xs text-muted-foreground">
            {formatDate(result.createdAt)}
          </div>
          <div className="flex items-center gap-1.5">
            <Badge variant="outline" className="text-xs capitalize">
              {result.mode}
            </Badge>
            {result.mode === "pairwise" &&
              (result as PairwiseEvalResult).positionBiasDetected && (
                <Badge
                  variant="outline"
                  className="text-xs border-orange-200 text-orange-600"
                >
                  bias
                </Badge>
              )}
          </div>
          <div className="text-sm truncate text-muted-foreground">
            {truncate(result.input.prompt, 50)}
          </div>
          <div className="flex items-center gap-2">
            <VerdictBadge result={result} />
            <span className="text-xs text-muted-foreground">
              {formatCost(result.estimatedCostUsd)}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={(e) => {
              e.stopPropagation();
              removeResult(result.id);
            }}
            className="text-muted-foreground hover:text-destructive p-1"
            title="Delete"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </div>

      {expanded && (
        <div className="px-3 pb-4">
          <EvaluationResult result={result} />
        </div>
      )}
    </div>
  );
}

export default function HistoryPage() {
  const { history, clearHistory } = useStore();
  const [filterMode, setFilterMode] = useState<"all" | "single" | "pairwise">(
    "all"
  );

  const filtered =
    filterMode === "all"
      ? history
      : history.filter((r) => r.mode === filterMode);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Evaluation History
          </h1>
          <p className="text-muted-foreground mt-1">
            {history.length} evaluation{history.length !== 1 ? "s" : ""} stored
            locally in your browser.
          </p>
        </div>

        {history.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            className="text-destructive hover:text-destructive gap-1.5"
            onClick={() => {
              if (confirm("Clear all history? This cannot be undone.")) {
                clearHistory();
              }
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Clear All
          </Button>
        )}
      </div>

      {history.length > 0 && (
        <div className="flex items-center gap-3">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select
            value={filterMode}
            onValueChange={(v) =>
              setFilterMode(v as "all" | "single" | "pairwise")
            }
          >
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All ({history.length})</SelectItem>
              <SelectItem value="single">
                Single ({history.filter((r) => r.mode === "single").length})
              </SelectItem>
              <SelectItem value="pairwise">
                Pairwise ({history.filter((r) => r.mode === "pairwise").length})
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="flex items-center justify-center min-h-[300px]">
            <div className="text-center text-muted-foreground space-y-2">
              <div className="text-4xl">📂</div>
              <p className="font-medium">No evaluations yet</p>
              <p className="text-sm">
                Run an evaluation to see results here.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          {/* Table header */}
          <div className="hidden sm:flex items-center gap-3 px-3 py-2 bg-muted/50 border-b text-xs font-medium text-muted-foreground uppercase tracking-wider">
            <div className="flex-1 min-w-0 grid grid-cols-4 gap-3">
              <span>Date</span>
              <span>Mode</span>
              <span>Prompt</span>
              <span>Result</span>
            </div>
            {/* invisible spacer matching the action buttons column */}
            <div className="flex items-center gap-1 flex-shrink-0 invisible" aria-hidden>
              <button className="p-1"><Trash2 className="h-3.5 w-3.5" /></button>
              <ChevronDown className="h-4 w-4" />
            </div>
          </div>
          <div>
            {filtered.map((result) => (
              <HistoryRow key={result.id} result={result} />
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
