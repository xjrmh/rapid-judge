"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Trophy, Minus, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ScoreBadge, AggregateScoreBadge } from "./score-badge";
import { formatCost, formatTokens, scoreToBarColor } from "@/lib/utils";
import type { EvalResult, SingleEvalResult, PairwiseEvalResult, CriterionScore } from "@/lib/types";

// ── Shared subcomponents ──────────────────────────────────────────────────────

function CriterionRow({ cs }: { cs: CriterionScore }) {
  const [open, setOpen] = useState(false);
  const pct = (cs.score / cs.maxScore) * 100;

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-3">
        <span className="flex-1 text-sm font-medium">{cs.criterionName}</span>
        <ScoreBadge score={cs.score} maxScore={cs.maxScore} size="sm" />
        <button
          onClick={() => setOpen((o) => !o)}
          className="text-muted-foreground hover:text-foreground"
        >
          {open ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </button>
      </div>
      <Progress
        value={pct}
        className="h-1.5"
        // Custom color via inline style since Progress doesn't take color props
      >
        <div
          className={`h-full rounded-full ${scoreToBarColor(cs.score, cs.maxScore)}`}
          style={{ width: `${pct}%` }}
        />
      </Progress>
      {open && cs.reasoning && (
        <p className="text-xs text-muted-foreground pl-0 pt-1 leading-relaxed">
          {cs.reasoning}
        </p>
      )}
    </div>
  );
}

function CriterionTable({ scores }: { scores: CriterionScore[] }) {
  return (
    <div className="space-y-3">
      {scores.map((cs) => (
        <CriterionRow key={cs.criterionId} cs={cs} />
      ))}
    </div>
  );
}

function ChainOfThought({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  if (!text) return null;

  return (
    <div className="rounded-md border bg-muted/30">
      <button
        className="flex w-full items-center justify-between px-4 py-2 text-sm font-medium hover:bg-muted/50 transition-colors"
        onClick={() => setOpen((o) => !o)}
      >
        <span>Chain-of-Thought Reasoning</span>
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>
      {open && (
        <div className="px-4 pb-4 pt-2 text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed border-t">
          {text}
        </div>
      )}
    </div>
  );
}

function TokenFooter({
  inputTokens,
  outputTokens,
  cost,
  model,
}: {
  inputTokens: number;
  outputTokens: number;
  cost: number;
  model: string;
}) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
      <span>Judge: <span className="font-medium text-foreground">{model}</span></span>
      <span>Input: <span className="font-medium text-foreground">{formatTokens(inputTokens)}</span> tokens</span>
      <span>Output: <span className="font-medium text-foreground">{formatTokens(outputTokens)}</span> tokens</span>
      <span>Cost: <span className="font-medium text-foreground">{formatCost(cost)}</span></span>
    </div>
  );
}

// ── Single result ─────────────────────────────────────────────────────────────

function SingleResult({ result }: { result: SingleEvalResult }) {
  return (
    <div className="space-y-5">
      {/* Aggregate score */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground mb-1">Aggregate Score</p>
          <AggregateScoreBadge score={result.aggregateScore} size="md" />
        </div>
        <div className="text-right">
          <p className="text-sm text-muted-foreground mb-1">Rubric</p>
          <Badge variant="outline">{result.rubric.name}</Badge>
        </div>
      </div>

      <Separator />

      {/* Summary */}
      {result.chainOfThought && (
        <div>
          <h3 className="text-sm font-semibold mb-2">Overall Assessment</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {/* Show last paragraph of CoT as summary */}
            {result.chainOfThought.split("\n").filter(Boolean).slice(-1)[0] ?? ""}
          </p>
        </div>
      )}

      {/* Criterion scores */}
      <div>
        <h3 className="text-sm font-semibold mb-3">Criteria Breakdown</h3>
        <CriterionTable scores={result.criterionScores} />
      </div>

      <Separator />

      {/* CoT */}
      <ChainOfThought text={result.chainOfThought} />

      {/* Footer */}
      <TokenFooter
        inputTokens={result.inputTokens}
        outputTokens={result.outputTokens}
        cost={result.estimatedCostUsd}
        model={result.judgeModel.name}
      />
    </div>
  );
}

// ── Pairwise result ───────────────────────────────────────────────────────────

function VerdictBanner({ result }: { result: PairwiseEvalResult }) {
  const { verdict, aggregateScoreA, aggregateScoreB } = result;
  const labelA = result.input.modelLabelA || "Response A";
  const labelB = result.input.modelLabelB || "Response B";

  let bannerClass = "bg-muted border";
  let icon = <Minus className="h-5 w-5" />;
  let text = "Tie — Both responses are equivalent";

  if (verdict === "A") {
    bannerClass = "bg-green-50 border-green-200 text-green-800";
    icon = <Trophy className="h-5 w-5 text-green-600" />;
    text = `${labelA} wins`;
  } else if (verdict === "B") {
    bannerClass = "bg-blue-50 border-blue-200 text-blue-800";
    icon = <Trophy className="h-5 w-5 text-blue-600" />;
    text = `${labelB} wins`;
  }

  return (
    <div className={`flex items-center gap-3 rounded-lg border px-4 py-3 ${bannerClass}`}>
      {icon}
      <div className="flex-1">
        <p className="font-semibold">{text}</p>
        {result.verdictReasoning && (
          <p className="text-sm mt-0.5 opacity-80">{result.verdictReasoning}</p>
        )}
      </div>
      <div className="text-right text-sm space-y-0.5">
        <div>A: <AggregateScoreBadge score={aggregateScoreA} size="sm" /></div>
        <div>B: <AggregateScoreBadge score={aggregateScoreB} size="sm" /></div>
      </div>
    </div>
  );
}

function PairwiseResult({ result }: { result: PairwiseEvalResult }) {
  const labelA = result.input.modelLabelA || "Response A";
  const labelB = result.input.modelLabelB || "Response B";

  return (
    <div className="space-y-5">
      {/* Verdict banner */}
      <VerdictBanner result={result} />

      {/* Position bias warning */}
      {result.positionBiasDetected && (
        <div className="flex items-start gap-2 rounded-md border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-800">
          <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0 text-orange-500" />
          <div>
            <p className="font-semibold">Position Bias Detected</p>
            <p className="opacity-80">
              The judge gave different verdicts when response order was swapped (
              {result.verdict} → {result.reversedVerdict}
              ). Treat this result with caution.
            </p>
          </div>
        </div>
      )}

      <Separator />

      {/* Side-by-side criteria */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            {labelA}
            <AggregateScoreBadge score={result.aggregateScoreA} size="sm" />
          </h3>
          <CriterionTable scores={result.criterionScoresA} />
        </div>
        <div>
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            {labelB}
            <AggregateScoreBadge score={result.aggregateScoreB} size="sm" />
          </h3>
          <CriterionTable scores={result.criterionScoresB} />
        </div>
      </div>

      <Separator />

      {/* CoT */}
      <ChainOfThought text={result.chainOfThought} />

      {/* Footer */}
      <TokenFooter
        inputTokens={result.inputTokens}
        outputTokens={result.outputTokens}
        cost={result.estimatedCostUsd}
        model={result.judgeModel.name}
      />
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

interface EvaluationResultProps {
  result: EvalResult;
  className?: string;
}

export function EvaluationResult({ result, className }: EvaluationResultProps) {
  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Evaluation Result</CardTitle>
      </CardHeader>
      <CardContent>
        {result.mode === "single" ? (
          <SingleResult result={result as SingleEvalResult} />
        ) : (
          <PairwiseResult result={result as PairwiseEvalResult} />
        )}
      </CardContent>
    </Card>
  );
}

export { Button };
