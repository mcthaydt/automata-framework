/**
 * What a command is given: the command names, the options of a run and the two things a review or an estimate hands
 * back in, so a decision or a run can be refused when what it was asked about has moved.
 */

import type { Units } from './budget.ts'

export const COMMANDS: readonly Command[] = [
  'status',
  'estimate',
  'run',
  'approve',
  'reject',
  'restore',
  'check',
  'adopt',
  'request',
]
export type Command =
  | 'status'
  | 'estimate'
  | 'run'
  | 'approve'
  | 'reject'
  | 'restore'
  | 'check'
  | 'adopt'
  | 'request'

export interface RunOptions {
  readonly command: Command
  /** The spec file, or the folder holding it. */
  readonly target: string
  readonly gate?: string | undefined
  readonly from?: string | undefined
  readonly to?: string | undefined
  readonly only?: readonly string[] | undefined
  readonly force?: boolean | undefined
  /** Lets paid stages run. */
  readonly paid?: boolean | undefined
  /** Per-run caps below `pipeline.toml`'s (`--budget images=2`). */
  readonly budget?: Units | undefined
  readonly note?: string | undefined
  /** `pipeline.toml`, when it is not at or above the target folder. */
  readonly config?: string | undefined
  /**
   * approve / reject: what the person was asked about (the gate's `requestedAt`, and the gated stage's input hash and
   * finish time when the request was recorded). A gate that no longer matches is refused (exit 4), so a decision never
   * lands on outputs the person did not see. The MCP review passes it; a person's own command does not.
   */
  readonly expect?: AskedAbout | undefined
  /**
   * run: the plan an estimate token covered (stage ids and input hashes). A run whose stages differ is refused before
   * anything runs, and a paid stage whose inputs differ is refused before its charge (exit 4).
   */
  readonly plan?: readonly PlannedStage[] | undefined
}

/** What a review asked the person about: see `RunOptions.expect`. */
export interface AskedAbout {
  readonly requestedAt: string
  readonly inputHash: string
  readonly at: string
}

/** One row of an estimated plan. `missing` means the inputs are made earlier in the same run. */
export interface PlannedStage {
  readonly id: string
  readonly inputHash: string
}
