// The write path every suite editor's edits take (editor suite spec §5 flows 3 and 4, EDS-D8, EDS-D19). One write:
// the policy (a `never`, generated or unlisted path is refused with why); the title prompt when there is a change set
// port and nothing is open (cancelled: nothing written); the `before` checks on the candidate text (a failure refuses
// the write with its findings, EDS-g); the mtime-guarded `SuiteWorkspace.write`; the change set's record of the path and
// both texts; then the `after` checks, whose results the journal keeps (`ChangeSet.note`) with each measure check's
// value before the change set's first write and after its latest.
//
// Undo and redo are steps of whole-file text. Each is written back through the same path, so it is checked and
// journalled like an edit; a step whose file no longer reads what this path wrote is refused with the path and kept
// (§11). Beginning a change set, and `clear()` (closing one), empty the history. Plain TypeScript: no DOM, no clock.
import type {
  ChangeSetCheck,
  CheckFinding,
  CheckMeasure,
  CheckResult,
  CheckRun,
  SuitePorts,
  SuiteWorkspace,
} from '@mcthaydt/automata-editor-kit/ports'

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

export interface WritePath {
  write(path: string, text: string, label: string): Promise<WriteOutcome>
  /** `undefined` with nothing to undo. */
  undo(): Promise<WriteOutcome | undefined>
  redo(): Promise<WriteOutcome | undefined>
  canUndo(): boolean
  canRedo(): boolean
  undoLabel(): string | undefined
  redoLabel(): string | undefined
  /** Empties the history (a change set begun or closed). */
  clear(): void
  /** Resolves once every `after` run started so far is in the journal. */
  settled(): Promise<void>
  subscribe(listener: () => void): () => void
}

interface Step {
  readonly path: string
  readonly label: string
  readonly before: string | undefined
  readonly after: string
}

export function createWritePath({ ports, title }: WritePathOptions): WritePath {
  const { workspace, changeSet, checks } = ports
  const steps: Step[] = []
  let done = 0
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
    steps.length = 0
    done = 0
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

  async function apply(path: string, text: string): Promise<WriteOutcome> {
    // A file not there yet is not listed: the workspace's own policy decides its write, and it names no checks.
    const file = (await workspace.files()).find((listed) => listed.path === path)
    if (file !== undefined && !file.writable) return { refused: 'policy', why: file.why ?? 'read only' }
    if (file === undefined && (await workspace.read(path)) !== undefined)
      return { refused: 'policy', why: 'no row of the editor list names it' }
    const checkIds = file?.checks ?? []
    if (!(await ensureChangeSet(checkIds))) return { cancelled: true }

    const before = declaredFor(checkIds, 'before')
    const beforeResults =
      before.length === 0
        ? []
        : await (await checks.run({ checks: before.map((c) => c.id), candidates: [{ path, text }] })).result()
    const failed = beforeResults.filter((result) => result.status === 'fail')
    if (failed.length > 0)
      return { refused: 'checks', findings: failed.flatMap((r) => r.findings), results: beforeResults }

    const current = await workspace.read(path)
    const known = wrote.get(path)
    if (known !== undefined && current?.mtime !== known) return { refused: 'moved', path }
    const result = await workspace.write(
      path,
      text,
      current === undefined ? 'absent' : { mtime: current.mtime },
    )
    if (!result.ok)
      return result.reason === 'policy'
        ? { refused: 'policy', why: result.message }
        : { refused: 'storage', reason: result.reason, message: result.message }
    wrote.set(path, result.mtime)

    if (changeSet !== undefined) {
      await changeSet.record([path], [{ path, before: current?.text, after: text }])
      if (beforeResults.length > 0) await changeSet.note(journal(beforeResults))
    }
    const after = declaredFor(checkIds, 'after')
    if (after.length === 0) return { written: true }
    const run = await checks.run({ checks: after.map((c) => c.id) })
    const noting = run.result().then((results) => changeSet?.note(journal(results)))
    pending = Promise.all([pending, noting])
    return { written: true, after: run }
  }

  /** Writes a step's side back, refusing when the file no longer reads what this path wrote. */
  async function replay(step: Step, from: string | undefined, to: string | undefined): Promise<WriteOutcome> {
    const current = await workspace.read(step.path)
    if (current?.text !== from || current?.mtime !== wrote.get(step.path))
      return { refused: 'moved', path: step.path }
    if (to !== undefined) return apply(step.path, to)
    if (current === undefined) return { written: true }
    const removed = await workspace.remove(step.path, { mtime: current.mtime })
    if (!removed.ok) return { refused: 'storage', reason: removed.reason, message: removed.message }
    wrote.delete(step.path)
    return { written: true }
  }

  return {
    async write(path, text, label) {
      const before = (await workspace.read(path))?.text
      const outcome = await apply(path, text)
      if ('written' in outcome) {
        steps.length = done
        steps.push({ path, label, before, after: text })
        done = steps.length
        changed()
      }
      return outcome
    },
    async undo() {
      const step = steps[done - 1]
      if (step === undefined) return undefined
      const outcome = await replay(step, step.after, step.before)
      if ('written' in outcome) {
        done--
        changed()
      }
      return outcome
    },
    async redo() {
      const step = steps[done]
      if (step === undefined) return undefined
      const outcome = await replay(step, step.before, step.after)
      if ('written' in outcome) {
        done++
        changed()
      }
      return outcome
    },
    canUndo: () => done > 0,
    canRedo: () => done < steps.length,
    undoLabel: () => steps[done - 1]?.label,
    redoLabel: () => steps[done]?.label,
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
