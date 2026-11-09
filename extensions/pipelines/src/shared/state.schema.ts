import { z } from 'zod'
import type { PipelineExit } from './exit.ts'

// The files a target folder keeps: `.stage.json` (stage id → record) and `gates.json` (gate → record, in
// `shared/gates-file.ts`), written only by the runner, and the one JSON object `--json` prints.

export type StageState = 'pending' | 'done' | 'skipped' | 'failed' | 'gated' | 'adopted'
export type GateDecision = 'pending' | 'approved' | 'rejected'

export interface StageRecord {
  readonly id: string
  readonly state: StageState
  /** The stage cache hash (XXH64, 16 hex digits), or `missing` when an input was. */
  readonly inputHash: string
  /** The outputs and restorable outputs, from the target folder. */
  readonly outputs: readonly string[]
  /** ISO time the stage finished, from Effect's Clock. */
  readonly at: string
  /** Paid stages: the units charged. */
  readonly cost?: Readonly<Record<string, number>> | undefined
  readonly notes?: string | undefined
  /** External task ids, for `restore`. */
  readonly tasks?: Readonly<Record<string, string>> | undefined
}

export interface GateRecord {
  readonly id: string
  readonly stage: string
  readonly decision: GateDecision
  /** What the person looks at: the gated stage's outputs. */
  readonly files: readonly string[]
  readonly summary?: string | undefined
  readonly note?: string | undefined
  readonly requestedAt?: string | undefined
  readonly decidedAt?: string | undefined
  /** Only a person decides a gate (the router refuses an agent's `approve`). */
  readonly by?: 'owner' | undefined
}

const units = z.record(z.string(), z.number().int().nonnegative())

export const stageFileSchema: z.ZodType<Record<string, StageRecord>> = z.record(
  z.string(),
  z
    .object({
      id: z.string(),
      state: z.enum(['pending', 'done', 'skipped', 'failed', 'gated', 'adopted']),
      inputHash: z.string(),
      outputs: z.array(z.string()),
      at: z.string(),
      cost: units.optional(),
      notes: z.string().optional(),
      tasks: z.record(z.string(), z.string()).optional(),
    })
    .strict(),
)

/** `pipeline-spend.json` beside `pipeline.toml`: units charged per budget key across the project. */
export const spendLedgerSchema: z.ZodType<Record<string, number>> = units

export interface StageRow {
  readonly id: string
  readonly state: StageState
  readonly paid?: true
  readonly gate?: string
  readonly cost?: Readonly<Record<string, number>>
}

/** What a command returns, and with `--json` the one object it prints. */
export interface PipelineResult {
  /** Done, or stopped at a gate. */
  readonly ok: boolean
  readonly pipeline: string
  readonly command: string
  /** The spec file, as the command was given it. */
  readonly target: string
  readonly exit: PipelineExit
  readonly stages: readonly StageRow[]
  readonly gates: readonly GateRecord[]
  /** Units the target's stage records were charged. */
  readonly spent: Readonly<Record<string, number>>
  /** `estimate`, and a budget refusal: the units the run needs. */
  readonly estimate?: Readonly<Record<string, number>>
  readonly error?: string
  /** Command-specific: the plan, the checks, the stale stages. */
  readonly data?: unknown
}
