// The Ship description (editor suite spec §5 flow 9, EDS-D10): drafted from the Review desk's model of the change
// set (its changed files, its checks and the gates it reopens), which the person edits before Ship. Nothing in it
// comes from a clock, and it says what Ship cannot do: a gate still needs the owner's decision.
import type { ReviewChangeSet } from './review-model'

const measureLines = (check: ReviewChangeSet['checks'][number]): string[] =>
  (check.after ?? []).map((after) => {
    const before = check.before?.find((measure) => measure.id === after.id)
    return before === undefined || before.value === after.value
      ? `  - ${after.label}: ${after.value}`
      : `  - ${after.label}: ${before.value} → ${after.value}`
  })

export function draftShip(review: ReviewChangeSet): { readonly title: string; readonly body: string } {
  const lines = ['## Changes', '']
  for (const file of review.files) lines.push(`- \`${file.path}\`${file.created ? ' (new)' : ''}`)
  if (review.files.length === 0) lines.push('No file differs from where the change set started.')

  lines.push('', '## Checks', '')
  for (const check of review.checks) {
    lines.push(`- ${check.check}: ${check.status}`)
    if (check.status !== 'pass')
      for (const finding of check.findings) {
        const place =
          finding.path === undefined
            ? ''
            : `${finding.path}${finding.line === undefined ? '' : `:${finding.line}`} `
        lines.push(`  - ${place}${finding.message}`)
      }
    lines.push(...measureLines(check))
  }
  if (review.checks.length === 0) lines.push('No checks have run.')

  lines.push('', '## Gates', '')
  const { reopened, unreadable } = review.gates
  for (const gate of reopened)
    lines.push(
      gate.decision === 'unknown'
        ? `- ${gate.id}: state unknown${unreadable === undefined ? '' : ` (${unreadable})`}`
        : `- ${gate.name} (${gate.id}): ${gate.decision} before this change, reopened by it.${gate.url === undefined ? '' : ` ${gate.url}`}`,
    )
  if (reopened.length === 0) lines.push('No gates.')
  else lines.push('', 'Gates still need the owner: the editor records no decision.')
  lines.push('')
  return { title: review.title, body: lines.join('\n') }
}
