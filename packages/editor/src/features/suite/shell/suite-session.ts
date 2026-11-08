// The suite's side of an editing session, without Svelte: the write path, the ports an editor is opened with (the same
// ports, except that `workspace.write` takes the write path, so every editor's edit is checked and written once) and
// the checks pill, which follows each write's `after` run.

import { ensureListed } from '../../../shared/editor-list/editor-rows'
import { createWritePath, type WriteOutcome, type WritePath } from '../../../shared/editor-list/write-path'
import type { CheckReport, SuitePorts } from '../../../shared/kit/ports/suite-ports.ts'
import type { TypingDrafts } from '../../../shared/kit/storage/typing-drafts'
import { checksPill, type Pill } from '../core/pills-model'

export interface SuiteSession {
  /** The ports the suite's own writes take. */
  readonly ports: SuitePorts
  /** The ports an editor is opened with: its writes join its own history on the write path (EDS-D19). */
  portsFor(editor: string): SuitePorts
  readonly writePath: WritePath
  /** Writes started and not finished: the page must not be left (or called saved) while this is above 0. */
  readonly inFlight: number
  /** The store's own words when the last write could not be kept (a full disk, a lost connection); none otherwise. */
  readonly failed: string | undefined
  pills(): readonly Pill[]
  /** Shows a write's `after` checks running on the pill until their results are in. */
  follow(outcome: WriteOutcome): Promise<void>
  /** `owner`'s undo or redo on the write path, its `after` checks followed on the pill; `undefined` with nothing to do. */
  undo(owner?: string): Promise<WriteOutcome | undefined>
  redo(owner?: string): Promise<WriteOutcome | undefined>
  /** Draws the pill again from the latest results. */
  refresh(): Promise<void>
  /** The label the next routed write records (the editor's own undo label when it has one). */
  label: () => string
  subscribe(listener: () => void): () => void
}

/** What an editor's `workspace.write` reports for an outcome of the write path. */
function resultOf(outcome: WriteOutcome, mtime: number | undefined) {
  if ('written' in outcome) return { ok: true as const, mtime: mtime ?? 0 }
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

export interface SuiteSessionOptions {
  /** The typing registry: its open visit joins the writes of one visit to a field into one Undo step. */
  readonly drafts?: TypingDrafts | undefined
}

export function createSuiteSession(raw: SuitePorts, options: SuiteSessionOptions = {}): SuiteSession {
  const { drafts } = options
  const listeners = new Set<() => void>()
  const changed = () => {
    for (const listener of listeners) listener()
  }
  let running = 0
  let inFlight = 0
  let failed: string | undefined
  /** Counts a write while it runs, so the saved line and the leave question know; keeps what a store refused. */
  async function counted(
    job: () => Promise<ReturnType<typeof resultOf>>,
  ): Promise<ReturnType<typeof resultOf>> {
    inFlight++
    changed()
    try {
      const result = await job()
      // A check's refusal and a file that moved are the person's to settle; anything else means the work is not kept.
      if (result.ok) failed = undefined
      else if (result.reason !== 'policy' && result.reason !== 'conflict') failed = result.message
      return result
    } finally {
      inFlight--
      drafts?.wrote()
      changed()
    }
  }
  /** The latest result of each check. */
  const latest = new Map<string, CheckReport>()
  let pills: readonly Pill[] = [checksPill({ running: false, checks: [] })]

  const writePath = createWritePath({ ports: raw })

  async function refresh(): Promise<void> {
    pills = [checksPill({ running: running > 0, checks: [...latest.values()] })]
    changed()
  }

  /** Shows the after run as running until its results are in. */
  async function follow(outcome: WriteOutcome): Promise<void> {
    if (!('written' in outcome) || outcome.after === undefined) return
    running++
    await refresh()
    const results = await outcome.after.result()
    for (const result of results) latest.set(result.check, { ...result })
    await writePath.settled()
    running--
    await refresh()
  }

  const portsFor = (owner: string): SuitePorts => ({
    ...raw,
    list: { ensure: (editor) => ensureListed(raw.workspace, editor) },
    visit: () => drafts?.visit(),
    workspace: {
      ...raw.workspace,
      write: (path, text) =>
        counted(async () => {
          const outcome = await writePath.write(path, text, session.label(), owner, { join: drafts?.visit() })
          const mtime = (await raw.workspace.read(path))?.mtime
          await refresh()
          void follow(outcome)
          return resultOf(outcome, mtime)
        }),
      writeAll: (files) =>
        counted(async () => {
          const outcome = await writePath.writeAll(files, session.label(), owner, { join: drafts?.visit() })
          const last = files.at(-1)
          const mtime = last === undefined ? undefined : (await raw.workspace.read(last.path))?.mtime
          await refresh()
          void follow(outcome)
          return resultOf(outcome, mtime)
        }),
    },
  })

  const session: SuiteSession = {
    ports: portsFor(''),
    portsFor,
    writePath,
    get inFlight() {
      return inFlight
    },
    get failed() {
      return failed
    },
    pills: () => pills,
    follow,
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
    label: () => 'Edit',
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
  writePath.subscribe(() => void refresh())
  return session
}
