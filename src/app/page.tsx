import Link from "next/link";
import { Scale, ArrowLeftRight, Layers, BookOpen, ArrowRight, Brain, Shield, BarChart3 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const FEATURES = [
  {
    href: "/evaluate/single",
    icon: Scale,
    title: "Single Evaluation",
    description:
      "Score an LLM response against a structured rubric. Get per-criterion scores, chain-of-thought reasoning, and an aggregate quality score.",
    badge: "Start here",
    color: "text-blue-600",
    bg: "bg-blue-50",
  },
  {
    href: "/evaluate/pairwise",
    icon: ArrowLeftRight,
    title: "Pairwise Comparison",
    description:
      "Compare two LLM responses head-to-head. Supports double-blind evaluation and position bias detection to ensure fair results.",
    badge: "Anti-bias",
    color: "text-purple-600",
    bg: "bg-purple-50",
  },
  {
    href: "/evaluate/batch",
    icon: Layers,
    title: "Batch Evaluation",
    description:
      "Upload a CSV or JSONL file to evaluate hundreds of responses at once. Download results for analysis in any tool.",
    badge: "Scale",
    color: "text-green-600",
    bg: "bg-green-50",
  },
  {
    href: "/evaluate/rubrics",
    icon: BookOpen,
    title: "Rubric Builder",
    description:
      "Create custom evaluation rubrics with weighted criteria. Choose from 5 built-in templates or build your own from scratch.",
    badge: "Customize",
    color: "text-orange-600",
    bg: "bg-orange-50",
  },
];

const PRINCIPLES = [
  {
    icon: Brain,
    title: "Chain-of-Thought Reasoning",
    description:
      "Judges explain their reasoning step-by-step before scoring, producing more calibrated and trustworthy evaluations.",
  },
  {
    icon: Shield,
    title: "Bias Mitigation",
    description:
      "Double-blind mode hides model labels. Position bias detection runs evaluations in both orders and flags disagreements.",
  },
  {
    icon: BarChart3,
    title: "Reproducible Results",
    description:
      "Temperature is fixed at 0.1 server-side. Same inputs produce consistent, comparable scores across evaluation runs.",
  },
];

export default function HomePage() {
  return (
    <div className="space-y-12">
      {/* Hero */}
      <div className="text-center space-y-4 pt-8">
        <div className="inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm text-muted-foreground bg-muted/50">
          <span>Powered by OpenAI · Anthropic · Google</span>
        </div>
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">
          Rapid Judge
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Automated LLM-as-judge evaluation. Score responses, compare models,
          and run batch evaluations — with built-in bias mitigation.
        </p>
        <div className="flex gap-3 justify-center">
          <Button asChild size="lg">
            <Link href="/evaluate/single">
              Start Evaluating
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/evaluate/rubrics">Build a Rubric</Link>
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Bring your own API keys — stored locally, never shared.
        </p>
      </div>

      {/* Feature cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {FEATURES.map(({ href, icon: Icon, title, description, badge, color, bg }) => (
          <Link key={href} href={href} className="group">
            <Card className="h-full hover:shadow-md transition-shadow cursor-pointer hover:border-primary/30">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div className={`p-2 rounded-lg ${bg}`}>
                    <Icon className={`h-5 w-5 ${color}`} />
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {badge}
                  </Badge>
                </div>
                <CardTitle className="text-base mt-3">{title}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-sm leading-relaxed">
                  {description}
                </CardDescription>
                <div className="mt-3 flex items-center text-sm text-primary font-medium group-hover:gap-2 transition-all">
                  Get started
                  <ArrowRight className="ml-1 h-3.5 w-3.5" />
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Principles */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-center">
          Built on LLM-as-Judge Best Practices
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {PRINCIPLES.map(({ icon: Icon, title, description }) => (
            <div key={title} className="space-y-2 p-4 rounded-lg bg-muted/30">
              <div className="flex items-center gap-2">
                <Icon className="h-5 w-5 text-primary" />
                <h3 className="font-medium text-sm">{title}</h3>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {description}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Quick start */}
      <Card className="bg-muted/30">
        <CardHeader>
          <CardTitle className="text-base">Quick Start</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex gap-3">
            <span className="font-mono text-primary font-bold">1.</span>
            <span>
              Go to the <strong>Settings</strong> tab in the nav to add your API
              key for OpenAI, Anthropic, or Google.
            </span>
          </div>
          <div className="flex gap-3">
            <span className="font-mono text-primary font-bold">2.</span>
            <span>
              Go to <strong>Single</strong> evaluation and paste a prompt +
              response to score.
            </span>
          </div>
          <div className="flex gap-3">
            <span className="font-mono text-primary font-bold">3.</span>
            <span>
              Use <strong>Pairwise</strong> to compare outputs from two
              different models.
            </span>
          </div>
          <div className="flex gap-3">
            <span className="font-mono text-primary font-bold">4.</span>
            <span>
              Use <strong>Batch</strong> to evaluate a CSV of responses at scale
              and download results.
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
