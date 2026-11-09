// The top bar's checks pill, as plain data the Svelte pill draws: a tone, a label, a count (what its icon form shows in
// the `short` tier, where the pills collapse to icons and are never hidden) and the items its popover lists.
import type { CheckFinding, CheckReport } from '../../../shared/kit/ports/suite-ports.ts'

export type PillTone = 'neutral' | 'running' | 'pass' | 'warn' | 'fail' | 'error'

export interface PillItem {
  readonly id: string
  readonly label: string
  readonly detail?: string | undefined
  readonly tone: PillTone
  /** A check's first finding: what Locate selects. */
  readonly finding?: CheckFinding | undefined
}

export interface Pill {
  readonly icon: 'checks'
  readonly tone: PillTone
  readonly label: string
  readonly detail?: string | undefined
  readonly count: number
  readonly items: readonly PillItem[]
}

/** Worst first: a failure is the one tap away. */
const SEVERITY: Readonly<Record<CheckReport['status'], number>> = { fail: 0, error: 1, warn: 2, pass: 3 }
const SAYS: Readonly<Record<CheckReport['status'], (check: string) => string>> = {
  fail: (check) => `${check} failed`,
  error: (check) => `${check} could not run`,
  warn: (check) => `${check} warns`,
  pass: () => 'Checks pass',
}

export function checksPill(input: {
  readonly running: boolean
  readonly checks: readonly CheckReport[]
}): Pill {
  const ordered = [...input.checks].sort((a, b) => SEVERITY[a.status] - SEVERITY[b.status])
  const items = ordered.map((run) => ({
    id: run.check,
    label: run.check,
    tone: run.status,
    finding: run.findings[0],
  }))
  const base = { icon: 'checks', items } as const
  if (input.running) return { ...base, tone: 'running', label: 'Checks running', count: items.length }
  const worst = ordered[0]
  if (worst === undefined) return { ...base, tone: 'neutral', label: 'No checks run', count: 0 }
  const matching = ordered.filter((run) => run.status === worst.status).length
  const count = worst.status === 'pass' ? items.length : matching
  return { ...base, tone: worst.status, label: SAYS[worst.status](worst.check), count }
}

/**
 * The pills worth a place in the top bar: each with something to say (a count, or a tone other than neutral). "No
 * checks run" is hidden, so a person sees a pill only when it means something.
 */
export function pillsToShow(pills: readonly Pill[]): readonly Pill[] {
  return pills.filter((pill) => pill.count > 0 || pill.tone !== 'neutral')
}
