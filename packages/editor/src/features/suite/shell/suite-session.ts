// The suite's side of an editing session (editor suite spec §5 flows 3, 4, 6 to 8; EDS-D19), without Svelte: the
// write path, the ports an editor is opened with (the same ports, except that `workspace.write` takes the write path,
// so every editor's edit is checked, written once and journalled), the three pills, and the title prompt the first
// write waits on. The pills are read back from the change set's journal, so a reload shows what it held (EDS-z).

import { loadEditorList } from '../../../shared/editor-list/editor-list'
import { EDITOR_LIST_PATH } from '../../../shared/editor-list/editors.schema'
import { createWritePath, type WriteOutcome, type WritePath } from '../../../shared/editor-list/write-path'
import type {
  ChangeSet,
  ChangeSetCheck,
  GateState,
  SuitePorts,
} from '../../../shared/kit/ports/suite-ports.ts'
import { applyImport, exportInterchange, type ImportPlan, planImport } from '../core/interchange'
import { changeSetPill, checksPill, gatesPill, type Pill } from '../core/pills-model'
import { changedPaths, reopenedGates } from '../core/reopened-gates'
import { type ReviewChangeSet, reviewModel } from '../core/review-model'
import { draftShip } from '../core/ship-draft'

/** What Ship gives back: the port's result, or the reason it failed (the commits stay local, §11). */
export type ShipOutcome = Awaited<ReturnType<ChangeSet['ship']>> | { readonly error: string }

export interface SuiteSessionOptions {
  /** The editor ids this build has: an import's section for any other is refused as not installed. */
  readonly installed?: readonly string[] | undefined
  /** The package that brings an editor id. */
  readonly provider?: ((editor: string) => string | undefined) | undefined
}

export interface SuiteSession {
  /** The ports the suite's own writes take (an import). */
  readonly ports: SuitePorts
  /** The ports an editor is opened with: its writes join its own history on the write path (EDS-D19). */
  portsFor(editor: string): SuitePorts
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
  /** `owner`'s undo or redo on the write path, its `after` checks followed on the pills; `undefined` with nothing to do. */
  undo(owner?: string): Promise<WriteOutcome | undefined>
  redo(owner?: string): Promise<WriteOutcome | undefined>
  /** Reads the journal and the gate records again. */
  refresh(): Promise<void>
  /** True when there is a change set port, so Ship is shown. */
  canShip(): boolean
  /** The open change sets as the Review desk shows them. */
  review(): Promise<readonly ReviewChangeSet[]>
  /** The Ship description drafted from the open change set, or `undefined` with none open. */
  draft(): Promise<{ readonly title: string; readonly body: string } | undefined>
  ship(draft: { readonly title: string; readonly body: string }): Promise<ShipOutcome>
  /** The interchange document of the listed files (of one scene, or the whole game). */
  exportGame(format: 'toml' | 'json', scene?: string): Promise<string>
  planImport(text: string, locked?: (path: string) => readonly string[]): Promise<ImportPlan>
  /** Applies a plan as one undo step, its `after` checks followed on the pills. */
  applyImport(plan: ImportPlan): Promise<WriteOutcome | { readonly refused: 'plan' }>
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

export function createSuiteSession(raw: SuitePorts, options: SuiteSessionOptions = {}): SuiteSession {
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

  async function review(): Promise<readonly ReviewChangeSet[]> {
    if (raw.changeSet === undefined) return []
    const summaries = await raw.changeSet.list()
    const files = await raw.workspace.files()
    return Promise.all(
      summaries.map(async (summary) => {
        const ids = reopenedGates(files, changedPaths(summary.writes))
        const states =
          raw.gates === undefined
            ? undefined
            : await raw.gates.states(ids).catch((error: unknown) => ({ error: messageOf(error) }))
        return reviewModel(summary, files, states)
      }),
    )
  }

  const portsFor = (owner: string): SuitePorts => ({
    ...raw,
    workspace: {
      ...raw.workspace,
      async write(path, text) {
        const outcome = await writePath.write(path, text, session.label(), owner)
        const mtime = (await raw.workspace.read(path))?.mtime
        await refresh()
        void follow(outcome)
        return resultOf(outcome, mtime)
      },
    },
  })

  const session: SuiteSession = {
    ports: portsFor(''),
    portsFor,
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
    async undo(owner) {
      const outcome = await writePath.undo(owner)
      if (outcome !== undefined) void follow(outcome)
      return outcome
    },
    async redo(owner) {
      const outcome = await writePath.redo(owner)
      if (outcome !== undefined) void follow(outcome)
      return outcome
    },
    refresh,
    canShip: () => raw.changeSet !== undefined,
    review,
    async draft() {
      const [open] = await review()
      return open === undefined ? undefined : draftShip(open)
    },
    async ship(draft) {
      if (raw.changeSet === undefined) return { error: 'There is no change set to ship.' }
      try {
        return await raw.changeSet.ship(draft)
      } catch (error) {
        return { error: messageOf(error) }
      } finally {
        await refresh()
      }
    },
    async exportGame(format, scene) {
      const listed = await raw.workspace.files(undefined, scene)
      const files = []
      for (const file of listed) {
        const read = await raw.workspace.read(file.path)
        if (read !== undefined) files.push({ path: file.path, editor: file.editor, text: read.text })
      }
      return exportInterchange(files, scene === undefined ? { format } : { format, scene })
    },
    async planImport(text, locked = () => []) {
      const load = loadEditorList((await raw.workspace.read(EDITOR_LIST_PATH))?.text)
      if (!load.ok) return { error: `${EDITOR_LIST_PATH} has a problem, so nothing can be imported.` }
      return planImport(text, {
        list: load.list,
        read: (path) => raw.workspace.read(path),
        installed: options.installed ?? [],
        provider: options.provider,
        locked,
      })
    },
    async applyImport(plan) {
      const outcome = await applyImport(plan, writePath)
      await refresh()
      if ('written' in outcome) void follow(outcome)
      return outcome
    },
    label: () => 'Edit',
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
  writePath.subscribe(() => void refresh())
  return session
}
