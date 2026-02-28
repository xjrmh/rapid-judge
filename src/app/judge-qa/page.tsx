"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Beaker, ShieldAlert, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import type { BiasCheckResult, CalibrationRun } from "@/lib/types";

const CALIBRATION_DEMO = `[
  {"humanVerdict":"A","judgeVerdict":"A","humanScore":88,"judgeScore":84},
  {"humanVerdict":"B","judgeVerdict":"B","humanScore":73,"judgeScore":69},
  {"humanVerdict":"A","judgeVerdict":"B","humanScore":90,"judgeScore":61},
  {"humanVerdict":"tie","judgeVerdict":"tie","humanScore":78,"judgeScore":79}
]`;

const BIAS_DEMO = `[
  {"verdictAB":"A","verdictBA":"B","responseALength":520,"responseBLength":180,"aggregateScoreA":82,"aggregateScoreB":71,"winningModelLabel":"gpt-4o","judgeModelLabel":"gpt-4o"},
  {"verdictAB":"B","verdictBA":"B","responseALength":230,"responseBLength":420,"aggregateScoreA":68,"aggregateScoreB":86,"winningModelLabel":"claude","judgeModelLabel":"gpt-4o"},
  {"verdictAB":"A","verdictBA":"A","responseALength":410,"responseBLength":405,"aggregateScoreA":80,"aggregateScoreB":78,"winningModelLabel":"gpt-4o","judgeModelLabel":"gpt-4o"}
]`;

export default function JudgeQAPage() {
  const [calibrationSetName, setCalibrationSetName] = useState("Synthetic Gold Set");
  const [calibrationPayload, setCalibrationPayload] = useState(CALIBRATION_DEMO);
  const [biasPayload, setBiasPayload] = useState(BIAS_DEMO);
  const [calibrating, setCalibrating] = useState(false);
  const [runningBias, setRunningBias] = useState(false);
  const [calibrationRun, setCalibrationRun] = useState<CalibrationRun | null>(null);
  const [biasResult, setBiasResult] = useState<BiasCheckResult | null>(null);

  function loadDemo() {
    setCalibrationSetName("Synthetic Gold Set");
    setCalibrationPayload(CALIBRATION_DEMO);
    setBiasPayload(BIAS_DEMO);
    setCalibrationRun(null);
    setBiasResult(null);
    toast.success("Demo payload loaded for both calibration and bias diagnostics.");
  }

  async function runCalibration() {
    setCalibrating(true);
    try {
      const records = JSON.parse(calibrationPayload) as unknown;
      const res = await fetch("/api/judge-qa/calibrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          setName: calibrationSetName.trim() || "Untitled Calibration Set",
          records,
        }),
      });
      const data = (await res.json()) as { run?: CalibrationRun; error?: string };
      if (!res.ok || !data.run) {
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      setCalibrationRun(data.run);
      toast.success("Calibration complete.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      toast.error(`Calibration failed: ${message}`);
    } finally {
      setCalibrating(false);
    }
  }

  async function runBiasCheck() {
    setRunningBias(true);
    try {
      const records = JSON.parse(biasPayload) as unknown;
      const res = await fetch("/api/judge-qa/bias-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ records }),
      });
      const data = (await res.json()) as { result?: BiasCheckResult; error?: string };
      if (!res.ok || !data.result) {
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      setBiasResult(data.result);
      toast.success("Bias diagnostics complete.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      toast.error(`Bias check failed: ${message}`);
    } finally {
      setRunningBias(false);
    }
  }

  return (
    <div className="tab-page">
      <div className="flex items-start justify-between gap-4">
        <div className="tab-header">
          <h1 className="tab-title">Judge QA</h1>
          <p className="tab-subtitle">
            Validate judge reliability with calibration and bias diagnostics before trusting score deltas.
          </p>
        </div>
        <Button variant="outline" onClick={loadDemo} className="shrink-0 gap-1.5 btn-demo">
          <Sparkles className="h-3.5 w-3.5" />
          Load Demo
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Beaker className="h-4 w-4" />
              Calibration vs Human Labels
            </CardTitle>
            <CardDescription>
              Measures exact match, Cohen&apos;s kappa, score correlation, and MAE on a gold set.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Set Name</Label>
              <Textarea
                value={calibrationSetName}
                onChange={(e) => setCalibrationSetName(e.target.value)}
                rows={1}
              />
            </div>
            <div className="space-y-2">
              <Label>Calibration Records (JSON array)</Label>
              <Textarea
                value={calibrationPayload}
                onChange={(e) => setCalibrationPayload(e.target.value)}
                rows={10}
                className="font-mono text-xs"
              />
            </div>
            <Button onClick={runCalibration} disabled={calibrating} className="w-full">
              {calibrating ? "Calibrating..." : "Run Calibration"}
            </Button>

            {calibrationRun && (
              <div className="rounded-md border p-3 text-sm space-y-2">
                <p className="font-medium">{calibrationRun.setName}</p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <p>Sample size: <strong>{calibrationRun.metrics.sampleSize}</strong></p>
                  <p>Exact match: <strong>{(calibrationRun.metrics.exactMatchRate * 100).toFixed(1)}%</strong></p>
                  <p>Cohen κ: <strong>{calibrationRun.metrics.cohenKappa.toFixed(3)}</strong></p>
                  <p>Score corr: <strong>{(calibrationRun.metrics.scoreCorrelation ?? 0).toFixed(3)}</strong></p>
                  <p>MAE: <strong>{(calibrationRun.metrics.meanAbsoluteError ?? 0).toFixed(3)}</strong></p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldAlert className="h-4 w-4" />
              Bias Diagnostics
            </CardTitle>
            <CardDescription>
              Checks position flips, verbosity correlation, and self-preference tendencies.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Bias Records (JSON array)</Label>
              <Textarea
                value={biasPayload}
                onChange={(e) => setBiasPayload(e.target.value)}
                rows={12}
                className="font-mono text-xs"
              />
            </div>
            <Button onClick={runBiasCheck} disabled={runningBias} className="w-full">
              {runningBias ? "Running..." : "Run Bias Diagnostics"}
            </Button>

            {biasResult && (
              <div className="rounded-md border p-3 text-sm space-y-2">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <p>Sample size: <strong>{biasResult.sampleSize}</strong></p>
                  <p>Position flips: <strong>{(biasResult.positionFlipRate * 100).toFixed(1)}%</strong></p>
                  <p>Verbosity corr: <strong>{biasResult.verbosityBiasCorrelation.toFixed(3)}</strong></p>
                  <p>Self preference: <strong>{(biasResult.selfPreferenceRate * 100).toFixed(1)}%</strong></p>
                </div>
                {biasResult.flags.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {biasResult.flags.map((flag) => (
                      <Badge key={flag} variant="outline" className="border-amber-200 text-amber-700">
                        {flag}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <Badge variant="secondary">No major bias flags</Badge>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
