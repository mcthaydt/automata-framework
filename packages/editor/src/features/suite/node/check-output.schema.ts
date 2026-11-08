// What a game's check prints on stdout. Two shapes are read: the suite's own, the port's
// findings and measures as they are, and `automata check --json`'s report (`packages/cli/src/check/check-report.ts`),
// whose findings are mapped to errors. Other keys are ignored, so a command may print more than the suite reads.

import { z } from 'zod'
import type { CheckFinding, CheckMeasure } from '../../../shared/kit/ports/suite-ports.ts'

const findingSchema: z.ZodType<CheckFinding> = z.object({
  path: z.string().optional(),
  keyPath: z.string().optional(),
  line: z.number().int().optional(),
  column: z.number().int().optional(),
  severity: z.enum(['error', 'warning']),
  message: z.string(),
})

const measureSchema: z.ZodType<CheckMeasure> = z.object({
  id: z.string(),
  label: z.string(),
  value: z.number(),
  threshold: z.number().optional(),
  ok: z.boolean(),
})

/** The suite's own shape: the port's findings and measures. */
export interface SuiteCheckOutput {
  readonly findings?: readonly CheckFinding[] | undefined
  readonly measure?: readonly CheckMeasure[] | undefined
}

/** `automata check --json`'s report: `{ ok, steps: [{ findings: [{ file, line, col, rule, message }] }] }`. */
export interface AutomataCheckOutput {
  readonly ok: boolean
  readonly steps: readonly {
    readonly findings: readonly {
      readonly file: string
      readonly line: number
      readonly col: number
      readonly rule: string
      readonly message: string
    }[]
  }[]
}

export const suiteCheckOutputSchema: z.ZodType<SuiteCheckOutput> = z.object({
  findings: z.array(findingSchema).optional(),
  measure: z.array(measureSchema).optional(),
})

export const automataCheckOutputSchema: z.ZodType<AutomataCheckOutput> = z.object({
  ok: z.boolean(),
  steps: z.array(
    z.object({
      findings: z.array(
        z.object({
          file: z.string(),
          line: z.number(),
          col: z.number(),
          rule: z.string(),
          message: z.string(),
        }),
      ),
    }),
  ),
})

export interface CheckOutput {
  readonly findings: readonly CheckFinding[]
  readonly measure?: readonly CheckMeasure[] | undefined
}
