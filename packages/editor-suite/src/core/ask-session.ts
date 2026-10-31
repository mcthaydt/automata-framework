// The Ask session behind the `ask-diff` dialog (editor suite spec §5 flow 5, §9, §11; EDS-D9: a proposal is one whole
// document). Rebuilt over text from ED3D.10a's headless controller (`editor-3d/src/app/ask-controller.ts`), keeping
// its rule: a proposal is shown and accepted only over the document it was made for, so an edit, undo or redo while it
// is in flight or on show drops it (`drop()`, or the document no longer reading what was sent).
//
// A proposal is refused before it is shown when it used more tokens than were left; on show it is diffed and the
// target file's `before` checks run on it. Accept is open only with no refusal: a failing check (its findings at their
// lines; Rewrite asks again with them), a locked value it changes (named by key, EDS-d), or a target the policy keeps
// from Ask (a `never` or generated path, or a row without `ask`, EDS-n). Accept writes through the write path, once,
// as one undo step labelled by the proposal's summary (EDS-f). The provider spends the tokens, kept or not.
import type {
  CheckFinding,
  CheckResult,
  Proposal,
  SuiteAskTarget,
  SuitePorts,
} from '@mcthaydt/automata-editor-kit/ports'
import { parse as parseToml } from 'smol-toml'
import { type Hunk, lineDiff } from './text-diff'
import type { WriteOutcome, WritePath } from './write-path'

export type AskRefusal =
  | { readonly kind: 'checks' }
  | { readonly kind: 'locked'; readonly key: string }
  | { readonly kind: 'policy'; readonly path: string; readonly why: string }

export type AskState =
  | { readonly kind: 'idle' }
  | { readonly kind: 'asking'; readonly prompt: string }
  | {
      readonly kind: 'shown'
      readonly prompt: string
      readonly proposal: Proposal
      readonly hunks: readonly Hunk[]
      readonly results: readonly CheckResult[]
      readonly findings: readonly CheckFinding[]
      readonly tokens: number
      readonly refusal?: AskRefusal | undefined
    }
  | { readonly kind: 'over-budget'; readonly tokens: number; readonly budget: number }
  | { readonly kind: 'failed'; readonly reason: string }

export interface AskSessionOptions {
  readonly target: SuiteAskTarget
  readonly ports: SuitePorts
  readonly writePath: WritePath
  /** The history on the write path an accepted proposal joins: the open editor's id (EDS-D19). */
  readonly owner?: string | undefined
  /** The budget with no change set open (default 200 000, The Last Light's cap). */
  readonly cap?: number | undefined
}

export interface AskSession {
  state(): AskState
  ask(prompt: string): Promise<void>
  /** Asks again with the shown proposal's findings added to its prompt. */
  rewrite(): Promise<void>
  /** Writes the shown proposal; `undefined` when nothing acceptable is shown. */
  accept(): Promise<WriteOutcome | undefined>
  /** Drops the shown proposal; the document, history and journal are untouched. */
  reject(): void
  /** The document changed under the session: drops a proposal in flight or on show. */
  drop(): void
  subscribe(listener: () => void): () => void
}

const messageOf = (error: unknown): string => (error instanceof Error ? error.message : String(error))

/** The document's value at a dotted key path (`file.0.gates`), or `undefined`. */
function valueAt(root: unknown, key: string): unknown {
  let value = root
  for (const part of key.split('.')) {
    if (typeof value !== 'object' || value === null) return undefined
    value = (value as Record<string, unknown>)[part]
  }
  return value
}

/** The first locked key whose value differs between the texts; a text that does not parse changes every key. */
function changedLock(
  path: string,
  before: string,
  after: string,
  locked: readonly string[],
): string | undefined {
  if (locked.length === 0) return undefined
  const read = (text: string): unknown => {
    try {
      return path.endsWith('.json') ? JSON.parse(text) : parseToml(text)
    } catch {
      return undefined
    }
  }
  const was = read(before)
  const now = read(after)
  if (now === undefined) return locked[0]
  return locked.find((key) => JSON.stringify(valueAt(was, key)) !== JSON.stringify(valueAt(now, key)))
}

export function createAskSession(options: AskSessionOptions): AskSession | undefined {
  const { target, ports, writePath, owner } = options
  if (ports.ask === undefined) return undefined
  const provider = ports.ask
  let state: AskState = { kind: 'idle' }
  /** Which request is current; a reply to an older one is dropped. */
  let generation = 0
  const listeners = new Set<() => void>()
  const set = (next: AskState) => {
    state = next
    for (const listener of listeners) listener()
  }

  async function budget(): Promise<number> {
    const open = ports.changeSet === undefined ? undefined : (await ports.changeSet.list())[0]
    return open === undefined ? (options.cap ?? 200_000) : Math.max(0, open.tokens.cap - open.tokens.used)
  }

  async function refusalOf(sent: string, text: string): Promise<AskRefusal | undefined> {
    const file = (await ports.workspace.files()).find((listed) => listed.path === target.path)
    if (file === undefined)
      return { kind: 'policy', path: target.path, why: 'no row of the editor list names it' }
    if (!file.writable) return { kind: 'policy', path: target.path, why: file.why ?? 'read only' }
    if (!file.modes.includes('ask'))
      return { kind: 'policy', path: target.path, why: 'its row does not allow Ask' }
    const key = changedLock(target.path, sent, text, target.locked())
    return key === undefined ? undefined : { kind: 'locked', key }
  }

  async function beforeChecks(text: string): Promise<CheckResult[]> {
    const file = (await ports.workspace.files()).find((listed) => listed.path === target.path)
    const ids = ports.checks
      .declared()
      .filter((check) => check.when === 'before' && (file?.checks ?? []).includes(check.id))
      .map((check) => check.id)
    if (ids.length === 0) return []
    return [
      ...(await (
        await ports.checks.run({ checks: ids, candidates: [{ path: target.path, text }] })
      ).result()),
    ]
  }

  async function ask(prompt: string): Promise<void> {
    const mine = ++generation
    const sent = target.text()
    set({ kind: 'asking', prompt })
    const left = await budget()
    if (mine !== generation) return
    if (left <= 0) return set({ kind: 'over-budget', tokens: 0, budget: left })
    let proposal: Proposal
    try {
      proposal = await provider.propose({
        prompt,
        path: target.path,
        scope: target.scope(),
        document: sent,
        budget: left,
      })
    } catch (error) {
      if (mine === generation) set({ kind: 'failed', reason: messageOf(error) })
      return
    }
    if (mine !== generation || target.text() !== sent) return
    if (proposal.tokens > left) return set({ kind: 'over-budget', tokens: proposal.tokens, budget: left })
    const results = await beforeChecks(proposal.text)
    if (mine !== generation || target.text() !== sent) return
    const failed = results.filter((result) => result.status === 'fail')
    const refusal =
      (await refusalOf(sent, proposal.text)) ?? (failed.length > 0 ? { kind: 'checks' } : undefined)
    if (mine !== generation || target.text() !== sent) return
    set({
      kind: 'shown',
      prompt,
      proposal,
      hunks: lineDiff(sent, proposal.text),
      results,
      findings: failed.flatMap((result) => result.findings),
      tokens: proposal.tokens,
      refusal,
    })
  }

  const dropAll = () => {
    generation++
    if (state.kind !== 'idle') set({ kind: 'idle' })
  }

  return {
    state: () => state,
    ask,
    async rewrite() {
      if (state.kind !== 'shown') return
      const findings = state.findings.map((finding) => `- line ${finding.line ?? '?'}: ${finding.message}`)
      await ask(`${state.prompt}\n\nThe checks refused the last proposal:\n${findings.join('\n')}`)
    },
    async accept() {
      if (state.kind !== 'shown' || state.refusal !== undefined) return undefined
      const { proposal } = state
      const outcome = await writePath.write(target.path, proposal.text, proposal.summary, owner)
      if ('written' in outcome) {
        target.accept(proposal.text, proposal.summary)
        dropAll()
      }
      return outcome
    },
    reject: dropAll,
    drop: dropAll,
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}
