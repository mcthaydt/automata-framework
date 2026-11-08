// What the suite says, in a toast, when a write, an undo or a redo does not land, and where a check found a problem.
// Each refusal already carries its own words (the check's findings, the rule, the storage's message); this only picks
// them, so the shell's markup holds no wording logic.
import type { WriteOutcome } from '../../../shared/editor-list/write-path'
import type { CheckFinding } from '../../../shared/kit/ports/suite-ports'

/** The toast for a refused write, or `undefined` when it landed, was cancelled, or never ran. */
export function refusalMessage(outcome: WriteOutcome | undefined): string | undefined {
  if (outcome === undefined || 'written' in outcome || 'cancelled' in outcome) return undefined
  switch (outcome.refused) {
    case 'moved':
      return `${outcome.path} changed since this step was written, so it was not undone.`
    case 'checks':
      return outcome.findings.map((finding) => finding.message).join('; ')
    case 'policy':
      return outcome.why
    case 'storage':
      return outcome.message
  }
}

/** A finding as one line: the file, then the key or the line when the check gave one, then the problem. */
export function findingMessage(finding: CheckFinding): string {
  const at = finding.keyPath ?? (finding.line === undefined ? undefined : `line ${finding.line}`)
  return `${[finding.path, at].filter(Boolean).join(', ')}: ${finding.message}`
}
