// A switch as a person reads it: where it goes from and to, and what must be true. The diagram's arrows, the list and the
// inspector all say a switch the same way.
import type { AgentDef, Transition } from '@automata/systems/sim'
import { ANY_MODE, type Timing, timingOf } from './diagram/layout.ts'
import { conditionWords } from './pieces/conditions.ts'
import { modeWords, type Names } from './pieces/piece.ts'

export const ANY_MODE_WORDS = 'Any mode it moves in'

/** A mode's name, or the words for "from any mode". */
export const fromWords = (mode: string): string => (mode === ANY_MODE ? ANY_MODE_WORDS : modeWords(mode))

/** Every condition of a switch, joined; "always" when it has none. */
export function whenWords(t: Transition, names: Names): string {
  return t.when.length === 0 ? 'always' : t.when.map((p) => conditionWords(p, names)).join(' and ')
}

export function switchWords(t: Transition, names: Names): string {
  // "From any mode it moves in to Catch", not "Any mode it moves in to Catch", which reads as two sentences run together.
  const from =
    t.from === ANY_MODE
      ? `From ${ANY_MODE_WORDS.charAt(0).toLowerCase()}${ANY_MODE_WORDS.slice(1)}`
      : fromWords(t.from)
  return `${from} to ${modeWords(t.to)}: ${whenWords(t, names)}`
}

/** The three times the interpreter asks switches, with the words for each group. */
export const TIMING_GROUPS: readonly { readonly timing: Timing; readonly title: string }[] = [
  { timing: 'always', title: 'All the time' },
  { timing: 'hears', title: 'When it hears something' },
  { timing: 'stops', title: 'When it stops or is stuck' },
]

/** A group's switches in the order they are checked: highest order number first, ties in the order written. */
export function groupOf(agent: AgentDef, timing: Timing): number[] {
  return agent.transitions
    .map((t, index) => ({ t, index }))
    .filter(({ t }) => timingOf(t.when) === timing)
    .sort((a, b) => b.t.priority - a.t.priority || a.index - b.index)
    .map(({ index }) => index)
}

/** An arrow's label: the first condition of its first switch, "and N more" for the rest of what its switches ask. */
export function arrowLabel(agent: AgentDef, switches: readonly number[], names: Names): string {
  const first = agent.transitions[switches[0] ?? 0]
  if (first === undefined) return ''
  const total = switches.reduce((sum, i) => sum + Math.max(1, agent.transitions[i]?.when.length ?? 0), 0)
  const head = first.when[0] === undefined ? 'always' : conditionWords(first.when[0], names)
  return total > 1 ? `${head} and ${total - 1} more` : head
}

/** A label's words in at most two lines of about `width` letters; what does not fit ends in "…". */
export function wrapLabel(text: string, width = 22): string[] {
  const words = text.split(' ')
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    if (line !== '' && `${line} ${word}`.length > width) {
      lines.push(line)
      line = word
    } else line = line === '' ? word : `${line} ${word}`
  }
  if (line !== '') lines.push(line)
  if (lines.length <= 2) return lines
  const [first = '', second = ''] = lines
  const rest = `${second} ${lines.slice(2).join(' ')}`.trim()
  return [first, rest.length > width ? `${rest.slice(0, width - 1).trimEnd()}…` : rest]
}
