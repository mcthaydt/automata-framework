// The suite's side of an editing session (editor suite spec §5 flows 3, 4, 6 to 8; EDS-D19), without Svelte: the
// write path, the ports an editor is opened with (the same ports, except that `workspace.write` takes the write path,
// so every editor's edit is checked, written once and journalled), the three pills, and the title prompt the first
// write waits on. The pills are read back from the change set's journal, so a reload shows what it held (EDS-z).
import type { ChangeSetCheck, GateState, SuitePorts } from '@mcthaydt/automata-editor-kit/ports'
import { changeSetPill, checksPill, gatesPill, type Pill } from '../core/pills-model'
import { changedPaths, reopenedGates } from '../core/reopened-gates'
import { createWritePath, type WriteOutcome, type WritePath } from '../core/write-path'

export interface SuiteSession {
  /** The ports editors are opened with. */
  readonly ports: SuitePorts
  readonly writePath: WritePath
  pills(): readonly Pill[]
  /** The open change set's tokens, when there is one. */
  tokens(): { readonly used: number; readonly cap: number } | undefined
  /** Shows a write's `after` checks running on the pills until they are in the journal. */
  follow(outcome: WriteOutcome): Promise<void>
  /** True while the first write waits for a change set's title. */
  asking(): boolean
  /** The person's title, or `undefined` for Cancel. */
  answerTitle(title: string | undefined): void
  /** The write path's undo or redo, its `after` checks followed on the pills; `undefined` with nothing to do. */
  undo(): Promise<WriteOutcome | undefined>
  redo(): Promise<WriteOutcome | undefined>
  /** Reads the journal and the gate records again. */
  refresh(): Promise<void>
  /** The label the next routed write records (the editor's own undo label when it has one). */
  label: () => string
  subscribe(listener: () => void): () => void
}

const messageOf = (error: unknown): string => (error instanceof Error ? error.message : String(error))

/** What an editor's `workspace.write` reports for an outcome of the write path. */
function resultOf(outcome: WriteOutcome, mtime: number | undefined) {
  if ('written' in outcome) return { ok: true as const, mtime: mtime ?? 0 }
  if ('cancelled' in outcome)
    return { ok: false as const, reason: 'policy' as const, message: 'No change set was started.' }
  if (outcome.refused === 'checks')
    return {
      ok: false as const,
      reason: 'policy' as const,
      message: outcome.findings.map((f) => f.message).join('; '),
    }
  if (outcome.refused === 'moved')
    return { ok: false as const, reason: 'conflict' as const, message: `${outcome.path} changed on disk.` }
  if (outcome.refused === 'policy')
    return { ok: false as const, reason: 'policy' as const, message: outcome.why }
  return { ok: false as const, reason: outcome.reason, message: outcome.message }
}

export function createSuiteSession(raw: SuitePorts): SuiteSession {
  const listeners = new Set<() => void>()
  const changed = () => {
    for (const listener of listeners) listener()
  }
  let title: ((value: string | undefined) => void) | undefined
  let running = 0
  let tokens: { readonly used: number; readonly cap: number } | undefined
  /** The latest results per check when there is no journal to keep them. */
  const local = new Map<string, ChangeSetCheck>()
  let pills: readonly Pill[] = [
    changeSetPill({ port: raw.changeSet !== undefined }),
    checksPill({ running: false, checks: [] }),
    gatesPill({ reopened: [], states: raw.gates === undefined ? undefined : [] }),
  ]

  const writePath = createWritePath({
    ports: raw,
    title: () =>
      new Promise((resolve) => {
        title = resolve
        changed()
      }),
  })

  async function refresh(): Promise<void> {
    const summary = raw.changeSet === undefined ? undefined : (await raw.changeSet.list())[0]
    tokens = summary?.tokens
    const files = await raw.workspace.files()
    const reopened = reopenedGates(files, changedPaths(summary?.writes ?? []))
    let states: readonly GateState[] | { error: string } | undefined
    if (raw.gates !== undefined)
      states = await raw.gates.states(reopened).catch((error: unknown) => ({ error: messageOf(error) }))
    pills = [
      changeSetPill({ port: raw.changeSet !== undefined, open: summary }),
      checksPill({ running: running > 0, checks: summary?.checks ?? [...local.values()] }),
      gatesPill({ reopened, states }),
    ]
    changed()
  }

  /** Shows the after run as running until its results are in the journal. */
  async function follow(outcome: WriteOutcome): Promise<void> {
    if (!('written' in outcome) || outcome.after === undefined) return
    running++
    await refresh()
    const results = await outcome.after.result()
    for (const result of results) local.set(result.check, { ...result })
    await writePath.settled()
    running--
    await refresh()
  }

  const session: SuiteSession = {
    ports: {
      ...raw,
      workspace: {
        ...raw.workspace,
        async write(path, text) {
          const outcome = await writePath.write(path, text, session.label())
          const mtime = (await raw.workspace.read(path))?.mtime
          await refresh()
          void follow(outcome)
          return resultOf(outcome, mtime)
        },
      },
    },
    writePath,
    pills: () => pills,
    tokens: () => tokens,
    follow,
    asking: () => title !== undefined,
    answerTitle(value) {
      const resolve = title
      title = undefined
      resolve?.(value)
      changed()
    },
    async undo() {
      const outcome = await writePath.undo()
      if (outcome !== undefined) void follow(outcome)
      return outcome
    },
    async redo() {
      const outcome = await writePath.redo()
      if (outcome !== undefined) void follow(outcome)
      return outcome
    },
    refresh,
    label: () => 'Edit',
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
  writePath.subscribe(() => void refresh())
  return session
}
