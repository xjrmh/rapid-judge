import { z } from "zod";

export const ScoreRangeSchema = z.union([z.literal(5), z.literal(10)]);

export const RubricCriterionSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    description: z.string().min(1),
    weight: z.number().finite().positive().max(1),
    scoreRange: ScoreRangeSchema,
  })
  .strict();

export const RubricSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    description: z.string(),
    criteria: z.array(RubricCriterionSchema).min(1),
    isBuiltIn: z.boolean(),
    createdAt: z.string().min(1),
  })
  .strict()
  .superRefine((rubric, ctx) => {
    const totalWeight = rubric.criteria.reduce((sum, c) => sum + c.weight, 0);
    if (!Number.isFinite(totalWeight) || totalWeight <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Rubric criteria weights must sum to a positive number",
        path: ["criteria"],
      });
      return;
    }

    if (Math.abs(totalWeight - 1) > 0.02) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Rubric criteria weights must sum to 1.0 (+/- 0.02)",
        path: ["criteria"],
      });
    }
  });

export const ModelIdSchema = z.string().min(1);
