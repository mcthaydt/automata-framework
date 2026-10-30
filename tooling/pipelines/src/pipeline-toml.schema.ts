import { z } from 'zod'

/** One budget key's caps, in units: across the whole project, and for one run. */
export interface Budget {
  readonly project: number
  readonly run: number
}

/**
 * A game's `pipeline.toml` (The Last Light's `pipeline.config.json` as TOML content). `budget` is the runner's;
 * `generated` (globs never hand-edited) and `locked` (values changed only by a recorded decision) are the guard's
 * (M3.8c), parsed here so the file has one schema.
 */
export interface PipelineToml {
  readonly budget: Readonly<Record<string, Budget>>
  readonly generated: readonly string[]
  readonly locked: Readonly<Record<string, string | number | boolean>>
}

interface PipelineTomlInput {
  readonly budget?: Readonly<Record<string, Budget>> | undefined
  readonly generated?: readonly string[] | undefined
  readonly locked?: Readonly<Record<string, string | number | boolean>> | undefined
}

const units = z.number().int().nonnegative()

const budgetSchema = z
  .object({ project: units, run: units })
  .strict()
  // Zod runs a refinement even when a field already failed; a cap that is not a whole number has its own issue.
  .refine(
    (budget) =>
      !(units.safeParse(budget.run).success && units.safeParse(budget.project).success) ||
      budget.run <= budget.project,
    {
      error: (issue) => {
        const budget = issue.input as Budget
        return `the run budget (${budget.run}) is above the project budget (${budget.project})`
      },
    },
  )

export const pipelineTomlSchema: z.ZodType<PipelineToml, PipelineTomlInput> = z
  .object({
    budget: z.record(z.string().regex(/^[a-z][A-Za-z0-9]*$/), budgetSchema).default({}),
    generated: z.array(z.string().min(1)).default([]),
    locked: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).default({}),
  })
  .strict()
