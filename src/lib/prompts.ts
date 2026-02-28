import type { Rubric, SingleEvalInput, PairwiseEvalInput } from "./types";

// ── Shared utilities ──────────────────────────────────────────────────────────

function formatCriteriaBlock(rubric: Rubric): string {
  return rubric.criteria
    .map(
      (c, i) =>
        `${i + 1}. **${c.name}** (weight: ${(c.weight * 100).toFixed(0)}%, score range: 1–${c.scoreRange})\n   ${c.description}`
    )
    .join("\n");
}

function formatSingleOutputSchema(rubric: Rubric): string {
  const scoreKeys = rubric.criteria
    .map((c) => `    "${c.id}": <integer between 1 and ${c.scoreRange}>`)
    .join(",\n");
  const reasoningKeys = rubric.criteria
    .map((c) => `    "${c.id}_reasoning": "<2-3 sentence explanation for this score>"`)
    .join(",\n");

  return `{
  "chain_of_thought": "<Concise scoring rationale (3-6 short bullet points). Do not output long hidden deliberation.>",
  "scores": {
${scoreKeys}
  },
  "criterion_reasoning": {
${reasoningKeys}
  },
  "aggregate_score": <float between 0.0 and 100.0, weighted average normalized to 0-100>,
  "summary": "<2-3 sentence overall assessment of the response quality>"
}`;
}

function formatPairwiseOutputSchema(rubric: Rubric): string {
  const scoreKeysA = rubric.criteria
    .map((c) => `    "${c.id}_A": <integer between 1 and ${c.scoreRange}>`)
    .join(",\n");
  const scoreKeysB = rubric.criteria
    .map((c) => `    "${c.id}_B": <integer between 1 and ${c.scoreRange}>`)
    .join(",\n");
  const reasoningKeysA = rubric.criteria
    .map((c) => `    "${c.id}_A_reasoning": "<explanation>"`)
    .join(",\n");
  const reasoningKeysB = rubric.criteria
    .map((c) => `    "${c.id}_B_reasoning": "<explanation>"`)
    .join(",\n");

  return `{
  "chain_of_thought": "<Concise comparison rationale (3-6 short bullet points) covering A, B, and final tradeoff.>",
  "scores": {
${scoreKeysA},
${scoreKeysB}
  },
  "criterion_reasoning": {
${reasoningKeysA},
${reasoningKeysB}
  },
  "summary": "<2-3 sentence overall comparison summary>",
  "aggregate_score_A": <float between 0.0 and 100.0>,
  "aggregate_score_B": <float between 0.0 and 100.0>,
  "verdict": "<exactly one of: 'A', 'B', or 'tie'>",
  "verdict_reasoning": "<2-3 sentences explaining your verdict — which response better served the user's need and why. If 'tie', explain why both are genuinely equivalent.>"
}`;
}

// ── Single evaluation prompt ──────────────────────────────────────────────────

export function buildSinglePrompt(
  input: SingleEvalInput,
  rubric: Rubric
): string {
  const contextBlock = input.context
    ? `\n## Reference Context / System Prompt\n${input.context}\n`
    : "";

  return `You are an expert LLM response evaluator. Your job is to score the given response against a structured rubric.

## Critical Instructions
- Analyze carefully, but output only concise rationale in "chain_of_thought" (3-6 bullets) before scores.
- Response LENGTH is NOT a proxy for quality. A concise, accurate answer can and should outscore a verbose, padded one.
- Score each criterion INDEPENDENTLY based on its specific definition.
- Use the FULL score range — do not cluster scores near the middle. A 1 means genuinely poor; the max score means genuinely excellent.
- Be calibrated: the same quality of response should receive the same score.
- Output ONLY valid JSON matching the exact schema below. No markdown code fences, no extra text before or after the JSON.
${contextBlock}
## Prompt Given to the LLM
${input.prompt}

## LLM Response to Evaluate
${input.response}

## Rubric: ${rubric.name}
${rubric.description}

### Criteria
${formatCriteriaBlock(rubric)}

## Output Schema (output this JSON and nothing else)
${formatSingleOutputSchema(rubric)}`;
}

// ── Pairwise evaluation prompt ────────────────────────────────────────────────

export function buildPairwisePrompt(
  input: PairwiseEvalInput,
  rubric: Rubric,
  order: "AB" | "BA" = "AB"
): string {
  const [responseFirst, responseSecond] =
    order === "AB"
      ? [input.responseA, input.responseB]
      : [input.responseB, input.responseA];
  const [labelFirst, labelSecond] =
    order === "AB"
      ? [
          input.modelLabelA?.trim() || "Model A",
          input.modelLabelB?.trim() || "Model B",
        ]
      : [
          input.modelLabelB?.trim() || "Model B",
          input.modelLabelA?.trim() || "Model A",
        ];
  const responseAHeading = input.doubleBlind
    ? "Response A"
    : `Response A (${labelFirst})`;
  const responseBHeading = input.doubleBlind
    ? "Response B"
    : `Response B (${labelSecond})`;

  const contextBlock = input.context
    ? `\n## Reference Context / System Prompt\n${input.context}\n`
    : "";
  const labelContext = input.doubleBlind
    ? "\n## Evaluation Mode\nDouble-blind. Model identities are intentionally hidden."
    : `\n## Evaluation Mode\nNot blind. Labels are provided:\n- Response A label: ${labelFirst}\n- Response B label: ${labelSecond}`;

  return `You are an expert LLM response evaluator. Your job is to compare two responses to the same prompt and determine which is better.

## Critical Instructions
- Analyze carefully, but output only concise rationale in "chain_of_thought" (3-6 bullets).
- Evaluate each response INDEPENDENTLY before comparing them — do not let your impression of one affect your scoring of the other.
- Response LENGTH is NOT a proxy for quality. Prefer substance, accuracy, and relevance over verbosity.
- Guard against POSITION BIAS: do not favor a response simply because it appears first or second.
- Use the FULL score range — do not cluster scores near the middle.
- The verdict must be exactly "A", "B", or "tie". Reserve "tie" for cases where both responses are genuinely equivalent in quality.
- Output ONLY valid JSON matching the exact schema below. No markdown code fences, no extra text.
${contextBlock}
${labelContext}
## Prompt Given to the LLM
${input.prompt}

## ${responseAHeading}
${responseFirst}

## ${responseBHeading}
${responseSecond}

## Rubric: ${rubric.name}
${rubric.description}

### Criteria
${formatCriteriaBlock(rubric)}

## Output Schema (output this JSON and nothing else)
${formatPairwiseOutputSchema(rubric)}`;
}
