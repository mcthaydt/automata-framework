import { type Readable, writable } from 'svelte/store'
import type { SuitePorts } from '../../../shared/kit/ports/suite-ports.ts'
import type { Tunable } from './tuner-content'
import { openTuner, type TunerOutcome, type TunerSession } from './tuner-session'

// What a person does in the Tuner: each action reads what is chosen, goes through the session (which holds the
// kind, the bounds, the lock and the write) and keeps a refusal in words until the next action. The components call these
// and draw what comes back; nothing here draws.

export interface TunerController {
  readonly session: TunerSession
  /** The sentence for the last refused action; cleared by the next. */
  readonly refusal: Readable<string | undefined>
  /** Moves after every step, drag value, lock and Undo: what a component re-reads the tunables on. */
  readonly revision: Readable<number>
  /** The tunable the inspector shows. */
  readonly selected: Readable<string | undefined>
  /** The search text. */
  readonly filter: Readable<string>
  /** Every tunable, in the file's order, or why the file cannot be shown. */
  all(): { readonly tunables: readonly Tunable[] } | { readonly problem: string }
  /** The tunables the search keeps. */
  visible(): readonly Tunable[]
  select(name: string | undefined): void
  setFilter(text: string): void
  set(name: string, value: number | boolean | string): Promise<TunerOutcome>
  dragStart(name: string): TunerOutcome
  dragUpdate(value: number | boolean | string): TunerOutcome
  dragCommit(): Promise<TunerOutcome>
  dragCancel(): void
  isLocked(name: string): boolean
  toggleLock(name: string): void
  create(): Promise<TunerOutcome>
  undo(): Promise<TunerOutcome>
  redo(): Promise<TunerOutcome>
}

export async function createTunerController(ports: SuitePorts): Promise<TunerController> {
  const session = await openTuner(ports)
  const refusal = writable<string | undefined>(undefined)
  const revision = writable(0)
  const selected = writable<string | undefined>(undefined)
  const filter = writable('')
  const bump = (): void => revision.update((count) => count + 1)
  session.history.subscribe(bump)

  let search = ''
  filter.subscribe((text) => {
    search = text.trim().toLowerCase()
  })

  const say = (outcome: TunerOutcome): TunerOutcome => {
    refusal.set(outcome.ok ? undefined : outcome.message)
    return outcome
  }

  return {
    session,
    refusal: { subscribe: refusal.subscribe },
    revision: { subscribe: revision.subscribe },
    selected: { subscribe: selected.subscribe },
    filter: { subscribe: filter.subscribe },
    all: () => {
      const read = session.read()
      return 'problem' in read ? read : { tunables: read.tunables }
    },
    visible: () => {
      const read = session.read()
      if ('problem' in read) return []
      return search === ''
        ? read.tunables
        : read.tunables.filter(
            (tunable) =>
              tunable.name.toLowerCase().includes(search) ||
              (tunable.note ?? '').toLowerCase().includes(search),
          )
    },
    select: (name) => selected.set(name),
    setFilter: (text) => filter.set(text),
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
    isLocked: (name) => session.locked().includes(name),
    toggleLock(name) {
      if (session.locked().includes(name)) session.unlock(name)
      else session.lock(name)
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
