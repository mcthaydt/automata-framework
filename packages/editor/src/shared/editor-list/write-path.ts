// The write path every suite editor's edits take (editor suite spec §5 flows 3 and 4, EDS-D8, EDS-D19). One write:
// the policy (a `never`, generated or unlisted path is refused with why); the title prompt when there is a change set
// port and nothing is open (cancelled: nothing written); the `before` checks on the candidate text (a failure refuses
// the write with its findings, EDS-g); the mtime-guarded `SuiteWorkspace.write`; the change set's record of the path and
// both texts; then the `after` checks, whose results the journal keeps (`ChangeSet.note`) with each measure check's
// value before the change set's first write and after its latest.
//
// `writeAll` is the same path over several files as one step (an import): every policy, expected mtime and `before`
// check is settled before anything is written, and a write failing part-way puts back the ones already written.
//
// Undo and redo are steps of whole-file text. Each is written back through the same path, so it is checked and
// journalled like an edit; a step any of whose files no longer reads what this path wrote is refused with that path and kept
// (§11). Each editor has its own history, named by its id (EDS-D19: the top bar's Undo acts on the active editor's
// document, so a switch to the Tuner and back still undoes the level's own step, EDS-k); the suite's own steps (an
// import) are the unnamed owner `''`. Beginning a change set, and `clear()` (closing one), empty every history. Plain
// TypeScript: no DOM, no clock.
import type {
  ChangeSetCheck,
  CheckFinding,
  CheckMeasure,
  CheckResult,
  CheckRun,
  SuitePorts,
  SuiteWorkspace,
  WorkspaceFile,
} from '../kit/ports/suite-ports.ts'

type WriteFailure = Extract<Awaited<ReturnType<SuiteWorkspace['write']>>, { ok: false }>['reason']

export type WriteOutcome =
  | { readonly written: true; readonly after?: CheckRun | undefined }
  | {
      readonly refused: 'checks'
      readonly findings: readonly CheckFinding[]
      readonly results: readonly CheckResult[]
    }
  | { readonly refused: 'moved'; readonly path: string }
  | { readonly refused: 'policy'; readonly why: string }
  | { readonly refused: 'storage'; readonly reason: WriteFailure; readonly message: string }
  | { readonly cancelled: true }

export interface WritePathOptions {
  readonly ports: SuitePorts
  /** The title prompt for the first write with no change set open; `undefined` when the person cancels. */
  readonly title: () => Promise<string | undefined>
}

/** One file of a `writeAll`: its new text and, when the caller read it earlier (an import plan), what it expected. */
export interface FileWrite {
  readonly path: string
  readonly text: string
  /** The file must still have this mtime, or not exist; refused as moved otherwise. */
  readonly expected?: { readonly mtime: number } | 'absent' | undefined
}

export interface WritePath {
  /** `owner` names the history the step joins: the editor's id, or `''` (the default) for the suite's own. */
  write(path: string, text: string, label: string, owner?: string): Promise<WriteOutcome>
  /** Several files as one undo step: every file is written, or none is (an import, EDS-D19). */
  writeAll(files: readonly FileWrite[], label: string, owner?: string): Promise<WriteOutcome>
  /** Undoes `owner`'s last step; `undefined` with nothing to undo. */
  undo(owner?: string): Promise<WriteOutcome | undefined>
  redo(owner?: string): Promise<WriteOutcome | undefined>
  canUndo(owner?: string): boolean
  canRedo(owner?: string): boolean
  undoLabel(owner?: string): string | undefined
  redoLabel(owner?: string): string | undefined
  /** Empties every history (a change set begun or closed). */
  clear(): void
  /** Resolves once every `after` run started so far is in the journal. */
  settled(): Promise<void>
  subscribe(listener: () => void): () => void
}

interface StepFile {
  readonly path: string
  readonly before: string | undefined
  readonly after: string
}

interface Step {
  readonly label: string
  readonly files: readonly StepFile[]
}

/** A file checked and ready to write: what it reads now and the check ids its row names. */
interface Prepared {
  readonly path: string
  readonly text: string
  readonly current: { readonly text: string; readonly mtime: number } | undefined
  readonly checks: readonly string[]
}

const unique = (ids: readonly string[]): string[] => [...new Set(ids)]

export function createWritePath({ ports, title }: WritePathOptions): WritePath {
  const { workspace, changeSet, checks } = ports
  /** Each owner's steps, and how many of them are done. */
  const histories = new Map<string, { steps: Step[]; done: number }>()
  const historyOf = (owner: string) => {
    let history = histories.get(owner)
    if (history === undefined) {
      history = { steps: [], done: 0 }
      histories.set(owner, history)
    }
    return history
  }
  /** The mtime each path had when this path last wrote it. */
  const wrote = new Map<string, number>()
  /** Each measure check's measures before the open change set's first write. */
  let baseline = new Map<string, readonly CheckMeasure[]>()
  let pending: Promise<unknown> = Promise.resolve()
  const listeners = new Set<() => void>()
  const changed = () => {
    for (const listener of listeners) listener()
  }

  const clear = () => {
    histories.clear()
    changed()
  }

  const declaredFor = (ids: readonly string[], when: 'before' | 'after') =>
    checks.declared().filter((check) => check.when === when && ids.includes(check.id))

  /** Opens a change set when the port is there and none is; false when the person cancels the title. */
  async function ensureChangeSet(checkIds: readonly string[]): Promise<boolean> {
    if (changeSet === undefined || (await changeSet.current()) !== undefined) return true
    const named = await title()
    if (named === undefined) return false
    await changeSet.begin(named)
    clear()
    // The measure checks' values before any write: the "before" the pill and the Review desk compare with.
    const measures = declaredFor(checkIds, 'after').filter((check) => check.measure)
    const results =
      measures.length === 0 ? [] : await (await checks.run({ checks: measures.map((c) => c.id) })).result()
    baseline = new Map(
      results.flatMap((result) => (result.measure === undefined ? [] : [[result.check, result.measure]])),
    )
    return true
  }

  function journal(results: readonly CheckResult[]): ChangeSetCheck[] {
    return results.map(({ check, status, findings, measure }) => ({
      check,
      status,
      findings,
      ...(measure === undefined ? {} : { before: baseline.get(check) ?? measure, after: measure }),
    }))
  }

  /** The policy and mtime of one file, before anything is written. */
  async function prepare(
    file: FileWrite,
    listed: readonly WorkspaceFile[],
  ): Promise<Prepared | WriteOutcome> {
    const { path, text, expected } = file
    // A file not there yet is not listed: the workspace's own policy decides its write, and it names no checks.
    const row = listed.find((entry) => entry.path === path)
    if (row !== undefined && !row.writable) return { refused: 'policy', why: row.why ?? 'read only' }
    const current = await workspace.read(path)
    if (row === undefined && current !== undefined)
      return { refused: 'policy', why: 'no row of the editor list names it' }
    const known = wrote.get(path)
    if (known !== undefined && current?.mtime !== known) return { refused: 'moved', path }
    if (
      expected === 'absent'
        ? current !== undefined
        : expected !== undefined && current?.mtime !== expected.mtime
    )
      return { refused: 'moved', path }
    return { path, text, current, checks: row?.checks ?? [] }
  }

  /** The `before` checks on the candidates; files naming the same checks share one run. */
  async function runBefore(prepared: readonly Prepared[]): Promise<CheckResult[]> {
    const groups = new Map<string, { ids: string[]; files: Prepared[] }>()
    for (const file of prepared) {
      const ids = declaredFor(file.checks, 'before').map((check) => check.id)
      if (ids.length === 0) continue
      const key = ids.join('\n')
      const group = groups.get(key) ?? { ids, files: [] }
      group.files.push(file)
      groups.set(key, group)
    }
    const results: CheckResult[] = []
    for (const { ids, files } of groups.values()) {
      const candidates = files.map(({ path, text }) => ({ path, text }))
      results.push(...(await (await checks.run({ checks: ids, candidates })).result()))
    }
    return results
  }

  /** Puts back what a part-way `applyAll` wrote, newest first. */
  async function rollBack(written: readonly { file: Prepared; mtime: number }[]): Promise<void> {
    for (const { file, mtime } of [...written].reverse()) {
      const result =
        file.current === undefined
          ? await workspace.remove(file.path, { mtime })
          : await workspace.write(file.path, file.current.text, { mtime })
      if (result.ok && file.current !== undefined) wrote.set(file.path, result.mtime)
      else wrote.delete(file.path)
    }
  }

  async function applyAll(files: readonly FileWrite[]): Promise<WriteOutcome> {
    const listed = await workspace.files()
    const prepared: Prepared[] = []
    for (const file of files) {
      const outcome = await prepare(file, listed)
      if (!('path' in outcome && 'checks' in outcome)) return outcome
      prepared.push(outcome)
    }
    const checkIds = unique(prepared.flatMap((file) => file.checks))
    if (!(await ensureChangeSet(checkIds))) return { cancelled: true }

    const beforeResults = await runBefore(prepared)
    const failed = beforeResults.filter((result) => result.status === 'fail')
    if (failed.length > 0)
      return { refused: 'checks', findings: failed.flatMap((r) => r.findings), results: beforeResults }

    const written: { file: Prepared; mtime: number }[] = []
    for (const file of prepared) {
      const result = await workspace.write(
        file.path,
        file.text,
        file.current === undefined ? 'absent' : { mtime: file.current.mtime },
      )
      if (!result.ok) {
        await rollBack(written)
        return result.reason === 'policy'
          ? { refused: 'policy', why: result.message }
          : { refused: 'storage', reason: result.reason, message: result.message }
      }
      wrote.set(file.path, result.mtime)
      written.push({ file, mtime: result.mtime })
    }

    if (changeSet !== undefined) {
      await changeSet.record(
        prepared.map((file) => file.path),
        prepared.map((file) => ({ path: file.path, before: file.current?.text, after: file.text })),
      )
      if (beforeResults.length > 0) await changeSet.note(journal(beforeResults))
    }
    const after = declaredFor(checkIds, 'after')
    if (after.length === 0) return { written: true }
    const run = await checks.run({ checks: after.map((c) => c.id) })
    const noting = run.result().then((results) => changeSet?.note(journal(results)))
    pending = Promise.all([pending, noting])
    return { written: true, after: run }
  }

  /**
   * Writes one side of a step back: every file must still read what this path wrote, or nothing is written and the
   * first that moved on is named. A file whose side is `undefined` (it did not exist) is removed after the writes.
   */
  async function replay(step: Step, side: 'before' | 'after'): Promise<WriteOutcome> {
    const from = side === 'before' ? 'after' : 'before'
    const reads = []
    for (const file of step.files) {
      const current = await workspace.read(file.path)
      if (current?.text !== file[from] || current?.mtime !== wrote.get(file.path))
        return { refused: 'moved', path: file.path }
      reads.push({ file, current })
    }
    const writes = step.files.flatMap((file) => {
      const text = file[side]
      return text === undefined ? [] : [{ path: file.path, text }]
    })
    const outcome = writes.length === 0 ? ({ written: true } as const) : await applyAll(writes)
    if (!('written' in outcome)) return outcome
    for (const { file, current } of reads) {
      if (file[side] !== undefined || current === undefined) continue
      const removed = await workspace.remove(file.path, { mtime: current.mtime })
      if (!removed.ok) return { refused: 'storage', reason: removed.reason, message: removed.message }
      wrote.delete(file.path)
    }
    return outcome
  }

  async function writeAll(files: readonly FileWrite[], label: string, owner = ''): Promise<WriteOutcome> {
    const befores = await Promise.all(files.map(async (file) => (await workspace.read(file.path))?.text))
    const outcome = await applyAll(files)
    if ('written' in outcome) {
      const history = historyOf(owner)
      history.steps.length = history.done
      history.steps.push({
        label,
        files: files.map((file, index) => ({ path: file.path, before: befores[index], after: file.text })),
      })
      history.done = history.steps.length
      changed()
    }
    return outcome
  }

  return {
    write: (path, text, label, owner) => writeAll([{ path, text }], label, owner),
    writeAll,
    async undo(owner = '') {
      const history = historyOf(owner)
      const step = history.steps[history.done - 1]
      if (step === undefined) return undefined
      const outcome = await replay(step, 'before')
      if ('written' in outcome) {
        history.done--
        changed()
      }
      return outcome
    },
    async redo(owner = '') {
      const history = historyOf(owner)
      const step = history.steps[history.done]
      if (step === undefined) return undefined
      const outcome = await replay(step, 'after')
      if ('written' in outcome) {
        history.done++
        changed()
      }
      return outcome
    },
    canUndo: (owner = '') => historyOf(owner).done > 0,
    canRedo: (owner = '') => historyOf(owner).done < historyOf(owner).steps.length,
    undoLabel: (owner = '') => historyOf(owner).steps[historyOf(owner).done - 1]?.label,
    redoLabel: (owner = '') => historyOf(owner).steps[historyOf(owner).done]?.label,
    clear,
    async settled() {
      await pending
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}
