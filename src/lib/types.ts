// ── Providers & Models ───────────────────────────────────────────────────────

export type Provider = "openai" | "anthropic" | "google";

export interface ModelSpec {
  id: string;
  name: string;
  provider: Provider;
  inputCostPer1M: number;  // USD per 1M input tokens
  outputCostPer1M: number; // USD per 1M output tokens
}

// ── Rubric ───────────────────────────────────────────────────────────────────

export type ScoreRange = 5 | 10;

export interface RubricCriterion {
  id: string;
  name: string;
  description: string;
  weight: number;       // 0–1, all criteria weights should sum to 1
  scoreRange: ScoreRange;
}

export interface Rubric {
  id: string;
  name: string;
  description: string;
  criteria: RubricCriterion[];
  isBuiltIn: boolean;
  createdAt: string;    // ISO date string
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
  criterionScores: CriterionScore[];
  aggregateScore: number; // 0–100
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
}

export interface PairwiseEvalResult {
  id: string;
  mode: "pairwise";
  createdAt: string;
  input: PairwiseEvalInput;
  rubric: Rubric;
  judgeModel: ModelSpec;
  chainOfThought: string;
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
}

export type EvalResult = SingleEvalResult | PairwiseEvalResult;

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

export interface AppSettings {
  apiKeys: ApiKeys;
  defaultModelId: string;
  defaultRubricId: string;
}
