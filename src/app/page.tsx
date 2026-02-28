"use client";

import Link from "next/link";
import { ArrowRight, BarChart3, Database, FlaskConical, ShieldCheck } from "lucide-react";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useStore } from "@/lib/store";
import { formatCost, formatDate } from "@/lib/utils";

const QUICK_ACTIONS = [
  {
    href: "/evaluate",
    title: "Run Evaluation",
    description: "Single, pairwise, and batch ad-hoc judging.",
    icon: BarChart3,
  },
  {
    href: "/datasets",
    title: "Manage Datasets",
    description: "Import immutable versions and inspect slices.",
    icon: Database,
  },
  {
    href: "/experiments",
    title: "Run Experiments",
    description: "Dataset-pinned runs, compare deltas, and gates.",
    icon: FlaskConical,
  },
  {
    href: "/judge-qa",
    title: "Judge QA",
    description: "Calibrate against human labels and bias diagnostics.",
    icon: ShieldCheck,
  },
];

function trend(values: number[]): number {
  if (values.length < 2) return 0;
  return values[values.length - 1] - values[0];
}

export default function DashboardPage() {
  const { experimentRuns, settings } = useStore();
  const recentRuns = [...experimentRuns].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt)
  );

  const latest12 = recentRuns.slice(0, 12);
  const avgScore =
    latest12.length === 0
      ? 0
      : latest12.reduce((sum, run) => sum + run.metrics.meanAggregateScore, 0) /
        latest12.length;
  const totalCost = latest12.reduce((sum, run) => sum + run.metrics.estimatedCostUsd, 0);
  const passRate =
    latest12.length === 0
      ? 0
      : latest12.reduce((sum, run) => sum + run.metrics.passRate, 0) / latest12.length;

  const scoreTrend = trend(latest12.map((run) => run.metrics.meanAggregateScore).reverse());
  const costTrend = trend(latest12.map((run) => run.metrics.estimatedCostUsd).reverse());
  const alerts: string[] = [];
  if (passRate < settings.alertThresholds.minAgreementRate) {
    alerts.push(
      `Pass rate ${(passRate * 100).toFixed(1)}% is below threshold ${(settings.alertThresholds.minAgreementRate * 100).toFixed(1)}%.`
    );
  }
  if (Math.abs(scoreTrend) > settings.alertThresholds.maxScoreDrift) {
    alerts.push(
      `Score drift ${scoreTrend.toFixed(2)} exceeds threshold ${settings.alertThresholds.maxScoreDrift.toFixed(2)}.`
    );
  }
  if (latest12.length >= 2) {
    const baselineCost = latest12[latest12.length - 1].metrics.estimatedCostUsd;
    const latestCost = latest12[0].metrics.estimatedCostUsd;
    const deltaPct = baselineCost === 0 ? 0 : ((latestCost - baselineCost) / baselineCost) * 100;
    if (deltaPct > settings.alertThresholds.maxCostIncreasePct) {
      alerts.push(
        `Cost increase ${deltaPct.toFixed(1)}% exceeds threshold ${settings.alertThresholds.maxCostIncreasePct.toFixed(1)}%.`
      );
    }
  }

  return (
    <div className="tab-page">
      <div className="tab-header">
        <h1 className="tab-title">Evaluation Dashboard</h1>
        <p className="tab-subtitle">
          Track recent runs, quality movement, and operational cost across your eval lifecycle.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MetricCard
          title="Mean Quality"
          value={avgScore.toFixed(1)}
          suffix="/100"
          trend={scoreTrend}
        />
        <MetricCard
          title="Mean Pass Rate"
          value={(passRate * 100).toFixed(1)}
          suffix="%"
          trend={0}
        />
        <MetricCard
          title="Cost (last 12 runs)"
          value={formatCost(totalCost)}
          trend={costTrend}
          showSigned={false}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {QUICK_ACTIONS.map(({ href, title, description, icon: Icon }) => (
          <Link key={href} href={href}>
            <Card className="h-full hover:border-primary/40 hover:shadow-sm transition-all">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Icon className="h-4 w-4 text-primary" />
                  {title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>{description}</CardDescription>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <Card>
        <CardHeader>
          <div>
            <CardTitle className="text-base">Recent Activity</CardTitle>
            <CardDescription>
              Latest ad-hoc and dataset runs now unified in the experiment lifecycle.
            </CardDescription>
          </div>
          <CardAction>
            <Button variant="outline" size="sm" asChild>
              <Link href="/experiments">
                Open Experiments
                <ArrowRight className="h-4 w-4 ml-1.5" />
              </Link>
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="space-y-2">
          {recentRuns.length === 0 ? (
            <p className="text-sm text-muted-foreground">No runs yet. Start from Evaluate or Experiments.</p>
          ) : (
            recentRuns.slice(0, 8).map((run) => (
              <div key={run.id} className="rounded-md border px-3 py-2">
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{run.runType}</Badge>
                    <span className="font-medium">{run.config.name ?? run.id}</span>
                    <Badge variant="secondary">{run.config.evalMode}</Badge>
                  </div>
                  <span className="text-xs text-muted-foreground">{formatDate(run.createdAt)}</span>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Score {run.metrics.meanAggregateScore.toFixed(1)} · Pass{" "}
                  {(run.metrics.passRate * 100).toFixed(1)}% · Cost{" "}
                  {formatCost(run.metrics.estimatedCostUsd)}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Operational Alerts</CardTitle>
          <CardDescription>
            Driven by thresholds from Settings for agreement floor, score drift, and cost increase.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {alerts.length === 0 ? (
            <Badge variant="secondary">No active alerts</Badge>
          ) : (
            alerts.map((alert) => (
              <div
                key={alert}
                className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900"
              >
                {alert}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function MetricCard({
  title,
  value,
  suffix,
  trend,
  showSigned = true,
}: {
  title: string;
  value: string;
  suffix?: string;
  trend: number;
  showSigned?: boolean;
}) {
  const trendLabel =
    trend === 0
      ? "No change"
      : `${trend > 0 ? "+" : ""}${trend.toFixed(2)} trend`;
  const trendClass =
    trend === 0 ? "text-muted-foreground" : trend > 0 ? "text-green-600" : "text-red-600";

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{title}</CardDescription>
        <CardTitle className="text-2xl">
          {value}
          {suffix && <span className="text-base text-muted-foreground ml-1">{suffix}</span>}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className={`text-xs ${trendClass}`}>
          {showSigned ? trendLabel : trend === 0 ? "Stable" : "Shift detected"}
        </p>
      </CardContent>
    </Card>
  );
}
