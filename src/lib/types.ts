// ── Providers & Models ───────────────────────────────────────────────────────

export type Provider = "openai" | "anthropic" | "google";

export interface ModelSpec {
  id: string;
  name: string;
  provider: Provider;
  inputCostPer1M: number; // USD per 1M input tokens
  outputCostPer1M: number; // USD per 1M output tokens
}

// ── Rubric ───────────────────────────────────────────────────────────────────

export type ScoreRange = 5 | 10;

export interface RubricCriterion {
  id: string;
  name: string;
  description: string;
  weight: number; // 0–1, all criteria weights should sum to 1
  scoreRange: ScoreRange;
}

export interface Rubric {
  id: string;
  name: string;
  description: string;
  criteria: RubricCriterion[];
  isBuiltIn: boolean;
  createdAt: string; // ISO date string
}

export interface RubricVersionRef {
  rubricId: string;
  versionId: string;
  versionNumber: number;
  fingerprint: string;
  createdAt: string;
  isBuiltIn: boolean;
}

export interface JudgePromptVersionRef {
  id: string;
  versionNumber: number;
  createdAt: string;
  notes?: string;
}

// ── Evaluation Inputs ────────────────────────────────────────────────────────

export type EvaluationMode = "single" | "pairwise";

export interface SingleEvalInput {
  prompt: string;
  response: string;
  rubricId: string;
  modelId: string;
  context?: string;
}

export interface PairwiseEvalInput {
  prompt: string;
  responseA: string;
  responseB: string;
  modelLabelA?: string;
  modelLabelB?: string;
  rubricId: string;
  modelId: string;
  doubleBlind: boolean;
  detectPositionBias: boolean;
  context?: string;
}

// ── Evaluation Outputs ───────────────────────────────────────────────────────

export interface CriterionScore {
  criterionId: string;
  criterionName: string;
  score: number;
  maxScore: ScoreRange;
  reasoning: string;
}

export type PairwiseVerdict = "A" | "B" | "tie";

export interface SingleEvalResult {
  id: string;
  mode: "single";
  createdAt: string;
  input: SingleEvalInput;
  rubric: Rubric;
  judgeModel: ModelSpec;
  chainOfThought: string;
  summary: string;
  criterionScores: CriterionScore[];
  aggregateScore: number; // 0–100
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
  rubricVersionRef?: RubricVersionRef;
  judgePromptVersionRef?: JudgePromptVersionRef;
}

export interface PairwiseEvalResult {
  id: string;
  mode: "pairwise";
  createdAt: string;
  input: PairwiseEvalInput;
  rubric: Rubric;
  judgeModel: ModelSpec;
  chainOfThought: string;
  summary: string;
  criterionScoresA: CriterionScore[];
  criterionScoresB: CriterionScore[];
  aggregateScoreA: number;
  aggregateScoreB: number;
  verdict: PairwiseVerdict;
  verdictReasoning: string;
  reversedVerdict?: PairwiseVerdict;
  reversedChainOfThought?: string;
  positionBiasDetected?: boolean;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
  rubricVersionRef?: RubricVersionRef;
  judgePromptVersionRef?: JudgePromptVersionRef;
}

export type EvalResult = SingleEvalResult | PairwiseEvalResult;

// ── Datasets ─────────────────────────────────────────────────────────────────

export type DatasetMode = "single" | "pairwise";

export interface DatasetItem {
  id: string;
  mode: DatasetMode;
  prompt: string;
  response?: string;
  responseA?: string;
  responseB?: string;
  context?: string;
  tags: string[];
  metadata?: Record<string, string>;
  goldScore?: number;
  goldVerdict?: PairwiseVerdict;
}

export interface DatasetSlice {
  id: string;
  label: string;
  value: string;
  itemCount: number;
}

export interface DatasetVersion {
  id: string;
  datasetId: string;
  versionNumber: number;
  createdAt: string;
  format: "csv" | "jsonl";
  hash: string;
  itemCount: number;
  items: DatasetItem[];
  slices: DatasetSlice[];
}

export interface Dataset {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  latestVersionId: string;
  totalVersions: number;
  tags: string[];
}

// ── Experiments ──────────────────────────────────────────────────────────────

export type ExperimentRunStatus = "queued" | "running" | "completed" | "failed";

export interface RunConfig {
  name?: string;
  datasetId?: string;
  datasetVersionId?: string;
  evalMode: EvaluationMode;
  judgeModelId: string;
  rubricId: string;
  repeats: number;
  rubricVersionRef?: RubricVersionRef;
  judgePromptVersionRef?: JudgePromptVersionRef;
  ensemble?: Array<{ modelId: string; weight: number }>;
  gates?: {
    minMeanAggregateScore?: number;
    minPassRate?: number;
  };
}

export interface RunMetricSummary {
  caseCount: number;
  meanAggregateScore: number;
  passRate: number;
  winRateA?: number;
  winRateB?: number;
  tieRate?: number;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
}

export interface ExperimentRun {
  id: string;
  identityKey: string;
  createdAt: string;
  runType: "adhoc" | "dataset";
  status: ExperimentRunStatus;
  config: RunConfig;
  datasetVersionId?: string;
  rubricVersionRef?: RubricVersionRef;
  judgePromptVersionRef?: JudgePromptVersionRef;
  metrics: RunMetricSummary;
  regression?: {
    passed: boolean;
    reasons: string[];
  };
  sourceEvalResultIds: string[];
  evalResults?: EvalResult[];
  notes?: string;
}

export interface RunComparison {
  baselineRunId: string;
  candidateRunId: string;
  compatible: boolean;
  warnings: string[];
  verdict: "improved" | "regressed" | "mixed" | "inconclusive";
  deltas: {
    meanAggregateScore: number;
    passRate: number;
    estimatedCostUsd: number;
    inputTokens: number;
    outputTokens: number;
    winRateA?: number;
    winRateB?: number;
    tieRate?: number;
  };
}

// ── Judge QA ─────────────────────────────────────────────────────────────────

export interface AgreementMetrics {
  sampleSize: number;
  exactMatchRate: number;
  cohenKappa: number;
  scoreCorrelation?: number;
  meanAbsoluteError?: number;
}

export interface CalibrationItem {
  id: string;
  prompt?: string;
  humanVerdict?: PairwiseVerdict;
  judgeVerdict?: PairwiseVerdict;
  humanScore?: number;
  judgeScore?: number;
}

export interface CalibrationSet {
  id: string;
  name: string;
  createdAt: string;
  items: CalibrationItem[];
}

export interface CalibrationRun {
  id: string;
  createdAt: string;
  setName: string;
  metrics: AgreementMetrics;
  notes?: string;
}

export interface BiasCheckResult {
  id: string;
  createdAt: string;
  sampleSize: number;
  positionFlipRate: number;
  verbosityBiasCorrelation: number;
  selfPreferenceRate: number;
  flags: string[];
}

// ── Batch ────────────────────────────────────────────────────────────────────

export type BatchRowStatus = "pending" | "running" | "done" | "error";

export interface BatchRow {
  index: number;
  input: SingleEvalInput | PairwiseEvalInput;
  mode: EvaluationMode;
  status: BatchRowStatus;
  result?: EvalResult;
  error?: string;
}

// ── Settings ─────────────────────────────────────────────────────────────────

export interface ApiKeys {
  openai?: string;
  anthropic?: string;
  google?: string;
}

export interface AlertThresholds {
  minAgreementRate: number;
  maxScoreDrift: number;
  maxCostIncreasePct: number;
}

export interface AppSettings {
  apiKeys: ApiKeys;
  defaultModelId: string;
  defaultRubricId: string;
  alertThresholds: AlertThresholds;
}
