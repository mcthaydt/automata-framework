import type { Diagnostic, Severity } from '../../profiles/profile'

// What the Checks view shows (plan ED2D.7a step 3; 2D editor spec §8, the Checks row): the profile's findings grouped
// by severity, the label of the repair each names, and the object each points at.

export interface CheckGroup {
  readonly severity: Severity
  readonly label: string
  readonly rows: readonly Diagnostic[]
}

const GROUPS: readonly { severity: Severity; title: string }[] = [
  { severity: 'error', title: 'Errors' },
  { severity: 'warning', title: 'Warnings' },
  { severity: 'info', title: 'Info' },
]

/** Errors, then warnings, then info, each in the profile's order; a severity with no findings has no group. */
export function checkGroups(found: readonly Diagnostic[]): readonly CheckGroup[] {
  return GROUPS.flatMap(({ severity, title }) => {
    const rows = found.filter((each) => each.severity === severity)
    return rows.length === 0 ? [] : [{ severity, label: `${title} (${rows.length})`, rows }]
  })
}

const LABELS: Readonly<Record<string, string>> = {
  'move-inside': 'Move inside',
  // The instance's field values go with it, so the button says so.
  delete: 'Delete anyway',
  'choose-target': 'Choose target',
}

/** The removal messages start with what they count (`3 cells use…`, `1 object uses…`). */
const COUNTED = /^(\d+) (cell|object)s? /

function removeLabel(diagnostic: Diagnostic): string {
  const counted = COUNTED.exec(diagnostic.message)
  if (counted === null) return 'Remove'
  const count = Number(counted[1])
  const noun = diagnostic.code === 'tileOutOfRange' && counted[2] === 'cell' ? 'stray tile' : counted[2]
  return `Remove ${count} ${noun}${count === 1 ? '' : 's'}`
}

/** The fix button's label, or undefined when the finding names no repair. */
export function fixLabel(diagnostic: Diagnostic): string | undefined {
  const { fix } = diagnostic
  if (fix === undefined) return undefined
  if (fix === 'remove') return removeLabel(diagnostic)
  if (Object.hasOwn(LABELS, fix)) return LABELS[fix]
  const words = fix.replaceAll('-', ' ')
  return words.charAt(0).toUpperCase() + words.slice(1)
}

const KINDS: readonly [RegExp, (match: RegExpExecArray) => string][] = [
  [/^levels\[([^\]]+)\]\.layers\[[^\]]+\]\.items\[([^\]]+)\]/, (m) => `${m[2]} in ${m[1]}`],
  [/^levels\[([^\]]+)\]\.layers\[([^\]]+)\]/, (m) => `Layer ${m[2]} in ${m[1]}`],
  [/^levels\[([^\]]+)\]/, (m) => `Level ${m[1]}`],
  [/^defs\.tilesets\[([^\]]+)\]/, (m) => `Tileset ${m[1]}`],
  [/^defs\.entities\[([^\]]+)\]/, (m) => `Entity ${m[1]}`],
  [/^defs\.layers\[([^\]]+)\]/, (m) => `Layer ${m[1]}`],
  [/^worlds\[([^\]]+)\]/, (m) => `World ${m[1]}`],
]

/** A short name for what a finding's path points at (`slime-2 in moss-steps`); the path itself when it is no project path. */
export function objectLabel(path: string): string {
  for (const [pattern, name] of KINDS) {
    const match = pattern.exec(path)
    if (match !== null) return name(match)
  }
  return path
}
