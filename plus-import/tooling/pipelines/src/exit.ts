/**
 * Every pipeline command's exit code (The Last Light's `scripts/pipe.mjs`): done, failed, not implemented, stopped
 * at a gate, refused. "At a gate" is a success for the caller: the run did what it could and waits for a person.
 */
export type PipelineExit = 0 | 1 | 2 | 3 | 4

export const EXIT: {
  readonly done: 0
  readonly failed: 1
  readonly notImplemented: 2
  readonly atGate: 3
  readonly refused: 4
} = {
  done: 0,
  failed: 1,
  notImplemented: 2,
  atGate: 3,
  refused: 4,
}
