import { type Readable, writable } from 'svelte/store'
import type { SuitePorts } from '../../../shared/kit/ports/suite-ports.ts'
import type { Tunable } from './tuner-content'
import { openTuner, type TunerOutcome, type TunerSession } from './tuner-session'

// What a person does in the Tuner: each action reads what is chosen, goes through the session (which holds the
// kind, the bounds and the write) and keeps a refusal in words until the next action. The components call these
// and draw what comes back; nothing here draws.

export interface TunerController {
  readonly session: TunerSession
  /** The sentence for the last refused action; cleared by the next. */
  readonly refusal: Readable<string | undefined>
  /** Moves after every step, drag value and Undo: what a component re-reads the tunables on. */
  readonly revision: Readable<number>
  /** Every tunable, in the file's order, or why the file cannot be shown. */
  all(): { readonly tunables: readonly Tunable[] } | { readonly problem: string }
  set(name: string, value: number | boolean | string): Promise<TunerOutcome>
  dragStart(name: string): TunerOutcome
  dragUpdate(value: number | boolean | string): TunerOutcome
  dragCommit(): Promise<TunerOutcome>
  dragCancel(): void
  create(): Promise<TunerOutcome>
  undo(): Promise<TunerOutcome>
  redo(): Promise<TunerOutcome>
}

export async function createTunerController(ports: SuitePorts): Promise<TunerController> {
  const session = await openTuner(ports)
  const refusal = writable<string | undefined>(undefined)
  const revision = writable(0)
  const bump = (): void => revision.update((count) => count + 1)
  session.history.subscribe(bump)

  const say = (outcome: TunerOutcome): TunerOutcome => {
    refusal.set(outcome.ok ? undefined : outcome.message)
    return outcome
  }

  return {
    session,
    refusal: { subscribe: refusal.subscribe },
    revision: { subscribe: revision.subscribe },
    all: () => {
      const read = session.read()
      return 'problem' in read ? read : { tunables: read.tunables }
    },
    async set(name, value) {
      return say(await session.set(name, value))
    },
    dragStart: (name) => say(session.drag.start(name)),
    dragUpdate(value) {
      const outcome = say(session.drag.update(value))
      bump()
      return outcome
    },
    async dragCommit() {
      return say(await session.drag.commit())
    },
    dragCancel() {
      session.drag.cancel()
      refusal.set(undefined)
      bump()
    },
    async create() {
      return say(await session.create())
    },
    async undo() {
      return say(await session.undo())
    },
    async redo() {
      return say(await session.redo())
    },
  }
}
