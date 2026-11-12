// The header's checks pill, as plain data the Svelte count draws: a tone, a label, a count, the findings counted and the
// items its list shows.
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
  /** The findings behind a warning or a failure, counted one by one: what the header says ("3 problems"). */
  readonly problems: number
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
  const found = ordered.reduce((sum, run) => sum + (run.status === 'pass' ? 0 : run.findings.length), 0)
  const base = { icon: 'checks', items } as const
  if (input.running)
    return { ...base, tone: 'running', label: 'Checks running', count: items.length, problems: found }
  const worst = ordered[0]
  if (worst === undefined) return { ...base, tone: 'neutral', label: 'No checks run', count: 0, problems: 0 }
  const matching = ordered.filter((run) => run.status === worst.status).length
  const count = worst.status === 'pass' ? items.length : matching
  // A check that failed without naming a finding is still one problem to fix.
  const problems = worst.status === 'pass' || worst.status === 'error' ? 0 : Math.max(found, matching)
  return { ...base, tone: worst.status, label: SAYS[worst.status](worst.check), count, problems }
}

/** What the header's problem count says, in a person's words, one short phrase for each state the checks can be in. */
export function problemWords(pill: Pill): string {
  if (pill.tone === 'running') return 'Checking…'
  if (pill.tone === 'neutral') return 'Not checked yet'
  if (pill.tone === 'pass') return 'No problems'
  if (pill.tone === 'error') return "Couldn't check"
  return `${pill.problems} ${pill.problems === 1 ? 'problem' : 'problems'}`
}
