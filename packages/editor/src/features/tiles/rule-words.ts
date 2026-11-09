// The words a person reads for an auto-tile rule. A rule's id is how the project stores it (`ground-n-e`); the editor
// shows a name made from it, and the words the pattern cells and the rule's flags use are here, so the list, the
// inspector and the preview say the same thing. Pure.

/** Where a solid neighbour is, as a person would say it from the tile being drawn. */
const PLACE: Readonly<Record<string, string>> = {
  n: 'above',
  e: 'to the right',
  s: 'below',
  w: 'to the left',
  ne: 'above right',
  se: 'below right',
  sw: 'below left',
  nw: 'above left',
}

const capital = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1)

/** "a, b and c". */
function listed(parts: readonly string[]): string {
  if (parts.length <= 1) return parts.join('')
  return `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}`
}

/**
 * A rule's name in words. The templates name a rule `<terrain>-<neighbours>` ("ground-n-e": ground with solid ground
 * above it and to its right), which reads "Ground, joined above and to the right". An id that is not in that form (a
 * rule the person made) is shown as its words: dashes read as spaces, the first letter raised.
 */
export function ruleTitle(id: string): string {
  const [terrain = '', ...rest] = id.split('-')
  if (rest.length === 1 && rest[0] === 'alone') return `${capital(terrain)}, on its own`
  if (rest.length > 0 && rest.every((part) => PLACE[part] !== undefined)) {
    return `${capital(terrain)}, joined ${listed(rest.map((part) => PLACE[part] as string))}`
  }
  return capital(id.replace(/-/g, ' '))
}

/** What a pattern cell holds, in words; `value` is the name of the kind of tile an `is` or `not` cell is about. */
export function cellWords(kind: 'any' | 'empty' | 'filled' | 'is' | 'not', value?: string): string {
  if (kind === 'any') return 'anything'
  if (kind === 'empty') return 'nothing'
  if (kind === 'filled') return 'something'
  return kind === 'is' ? `only ${value}` : `anything but ${value}`
}

/** The names of a rule's three switches, for the buttons, the undo steps and the list. */
export const FLAG_WORDS = {
  flipX: 'Mirror left to right',
  flipY: 'Flip upside down',
  breakOnMatch: 'Stop after this rule',
} as const
