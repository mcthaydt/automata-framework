// The top bar's three pills (editor suite spec §5 flows 6 and 7, §9 `suite-home`, §10, §11): the change set, the
// checks and the reopened gates, as plain data the Svelte pills draw. Each pill has a tone, a label, a count (what its
// icon form shows in the `short` tier, where the pills collapse to icons and are never hidden) and the items its
// popover lists. The gates pill only shows decisions; nothing here records one.
import type { ChangeSetCheck, CheckFinding, GateState } from '@mcthaydt/automata-editor-kit/ports'

export type PillTone = 'neutral' | 'running' | 'pass' | 'warn' | 'fail' | 'error'

export interface PillMeasure {
  readonly label: string
  readonly before: number | undefined
  readonly after: number | undefined
  readonly ok: boolean
}

export interface PillItem {
  readonly id: string
  readonly label: string
  readonly detail?: string | undefined
  readonly tone: PillTone
  /** A gate's record. */
  readonly href?: string | undefined
  /** A check's first finding: what Locate selects. */
  readonly finding?: CheckFinding | undefined
  readonly measures?: readonly PillMeasure[] | undefined
}

export interface Pill {
  readonly icon: 'change-set' | 'checks' | 'gates'
  readonly tone: PillTone
  readonly label: string
  readonly detail?: string | undefined
  readonly count: number
  readonly items: readonly PillItem[]
}

export function changeSetPill(input: {
  readonly port: boolean
  readonly open?: { readonly title: string; readonly files: readonly string[] } | undefined
}): Pill {
  const base = { icon: 'change-set', tone: 'neutral', count: 0, items: [] } as const
  if (!input.port) return { ...base, label: 'Saving to the workspace' }
  if (input.open === undefined) return { ...base, label: 'No change set' }
  const items = input.open.files.map((path) => ({ id: path, label: path, tone: 'neutral' as const }))
  return { ...base, label: input.open.title, count: items.length, items }
}

/** Worst first: a failure is the one tap away. */
const SEVERITY: Readonly<Record<ChangeSetCheck['status'], number>> = { fail: 0, error: 1, warn: 2, pass: 3 }
const SAYS: Readonly<Record<ChangeSetCheck['status'], (check: string) => string>> = {
  fail: (check) => `${check} failed`,
  error: (check) => `${check} could not run`,
  warn: (check) => `${check} warns`,
  pass: () => 'Checks pass',
}

function measuresOf(run: ChangeSetCheck): PillMeasure[] | undefined {
  const ids = [...new Set([...(run.before ?? []), ...(run.after ?? [])].map((measure) => measure.id))]
  if (ids.length === 0) return undefined
  return ids.map((id) => {
    const before = run.before?.find((measure) => measure.id === id)
    const after = run.after?.find((measure) => measure.id === id)
    return {
      label: (after ?? before)?.label ?? id,
      before: before?.value,
      after: after?.value,
      ok: (after ?? before)?.ok ?? true,
    }
  })
}

export function checksPill(input: {
  readonly running: boolean
  readonly checks: readonly ChangeSetCheck[]
}): Pill {
  const ordered = [...input.checks].sort((a, b) => SEVERITY[a.status] - SEVERITY[b.status])
  const items = ordered.map((run) => ({
    id: run.check,
    label: run.check,
    tone: run.status,
    finding: run.findings[0],
    measures: measuresOf(run),
  }))
  const base = { icon: 'checks', items } as const
  if (input.running) return { ...base, tone: 'running', label: 'Checks running', count: items.length }
  const worst = ordered[0]
  if (worst === undefined) return { ...base, tone: 'neutral', label: 'No checks run', count: 0 }
  const matching = ordered.filter((run) => run.status === worst.status).length
  const count = worst.status === 'pass' ? items.length : matching
  return { ...base, tone: worst.status, label: SAYS[worst.status](worst.check), count }
}

/** `states`: the records, `{ error }` when they did not read, `undefined` without the port. */
export function gatesPill(input: {
  readonly reopened: readonly string[]
  readonly states: readonly GateState[] | { readonly error: string } | undefined
}): Pill {
  const base = { icon: 'gates', count: input.reopened.length } as const
  if (input.states === undefined || 'error' in input.states)
    return {
      ...base,
      tone: 'warn',
      label: 'Gates not readable',
      detail: input.states === undefined ? 'no gate records here' : input.states.error,
      items: [],
    }
  const states = input.states
  if (input.reopened.length === 0) return { ...base, tone: 'neutral', label: 'No gates', items: [] }
  const items = input.reopened.map((id) => {
    const state = states.find((gate) => gate.id === id)
    const decision = state === undefined || state.decision === 'unknown' ? 'state unknown' : state.decision
    return {
      id,
      label: state?.name ?? id,
      detail: state?.decidedAt === undefined ? decision : `${decision} ${state.decidedAt}`,
      tone: 'warn' as const,
      href: state?.url,
    }
  })
  const label = `${items.length} ${items.length === 1 ? 'gate' : 'gates'} reopened`
  return { ...base, tone: 'warn', label, items }
}
