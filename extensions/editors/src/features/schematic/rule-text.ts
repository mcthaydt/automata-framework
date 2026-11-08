// A world rule added, replaced or taken out in the behaviour file's text. A rule's conditions and actions are tables
// inside the rule, which the kit's patch writer cannot add to or remove from, so (like a switch, `switch-text.ts`) the
// rule's own tables are written again as text, and every byte outside them stays. The result is read back with the
// kit's reader and with the game's, and must be the file as it was with that one change; if not, nothing is written.
import { openDocument } from '@automata/editor/kit/documents'
import type { SystemsDef } from '@automata/systems/sim'
import { parse as strictParse, stringify } from 'smol-toml'
import { canonical, headersOf, NOT_FOUND, splice } from './switch-text.ts'

type Rule = SystemsDef['rules'][number]

export type RuleChange =
  | { readonly kind: 'replace'; readonly index: number; readonly next: Rule }
  | { readonly kind: 'remove'; readonly index: number }
  | { readonly kind: 'add'; readonly next: Rule }

const blank = (line: string | undefined): boolean => /^\s*(#.*)?$/.test(line ?? '')

/** The rule as the text of its tables (`[[rules]]` and what is inside it). */
export function ruleTables(rule: Rule): string[] {
  const clean = JSON.parse(JSON.stringify(rule)) as Record<string, unknown>
  const lines = stringify({ rules: [clean] }).split('\n')
  while (lines.length > 0 && lines[lines.length - 1] === '') lines.pop()
  return lines
}

interface Span {
  readonly start: number
  readonly end: number
}

/** Where rule `index` is, or where a new one goes (`index` just past the last), as the lines it takes. */
function locate(lines: readonly string[], index: number): Span | { readonly at: number } | undefined {
  const headers = headersOf(lines)
  const rules = headers.filter((h) => h.name === 'rules' && h.array)
  const trim = (end: number): number => {
    let at = end
    while (at > 0 && blank(lines[at - 1])) at -= 1
    return at
  }
  const target = rules[index]
  if (target !== undefined) return { start: target.line, end: endOfRule(headers, lines, target.line, trim) }
  if (index !== rules.length) return undefined
  const last = rules[rules.length - 1]
  return { at: last === undefined ? trim(lines.length) : endOfRule(headers, lines, last.line, trim) }
}

/** One past the last line of the rule that starts at `start`: its own sub-tables count, the next table does not. */
function endOfRule(
  headers: ReturnType<typeof headersOf>,
  lines: readonly string[],
  start: number,
  trim: (end: number) => number,
): number {
  const next = headers.find((h) => h.line > start && !h.name.startsWith('rules.'))
  return trim(next?.line ?? lines.length)
}

/** The line of the file's own `rules = []`, written before its first table. */
function inlineEmptyLine(lines: readonly string[]): number | undefined {
  const first = headersOf(lines)[0]?.line ?? lines.length
  for (let i = 0; i < first; i += 1) if (/^\s*rules\s*=\s*\[\s*\]\s*(#.*)?$/.test(lines[i] ?? '')) return i
  return undefined
}

function withoutInlineEmpty(text: string): string {
  const lines = text.split('\n')
  const at = inlineEmptyLine(lines)
  if (at === undefined) return text
  lines.splice(at, 1)
  return lines.join('\n')
}

/** The key the file needs when it holds no rule: after its other top-level keys, before its first table. */
function withInlineEmpty(text: string): string {
  const lines = text.split('\n')
  let at = headersOf(lines)[0]?.line ?? lines.length
  while (at > 0 && blank(lines[at - 1])) at -= 1
  lines.splice(at, 0, 'rules = []')
  return lines.join('\n')
}

/** The file's text with one rule replaced, removed or added, or why not. */
export function changeRuleText(
  path: string,
  text: string,
  change: RuleChange,
): { readonly text: string } | { readonly refused: string } {
  let intended: Record<string, unknown>
  try {
    intended = openDocument(path, text).value() as Record<string, unknown>
  } catch {
    return { refused: 'This file has a mistake, so it is read only until the mistake is fixed.' }
  }
  const rules = intended.rules
  if (!Array.isArray(rules)) return { refused: NOT_FOUND }
  const copy = (value: unknown): unknown => JSON.parse(JSON.stringify(value))
  let next: string | undefined
  const lines = text.split('\n')
  if (change.kind === 'add') {
    const base = rules.length === 0 ? withoutInlineEmpty(text) : text
    const place = locate(base.split('\n'), rules.length)
    next =
      place !== undefined && 'at' in place
        ? splice(base, place.at, place.at, ['', ...ruleTables(change.next)])
        : undefined
    rules.push(copy(change.next))
  } else {
    const place = locate(lines, change.index)
    if (place === undefined || !('start' in place)) return { refused: NOT_FOUND }
    if (change.kind === 'replace') {
      next = splice(text, place.start, place.end, ruleTables(change.next))
      rules[change.index] = copy(change.next)
    } else {
      const after =
        place.end < lines.length && (lines[place.end] ?? '').trim() === '' ? place.end + 1 : place.end
      next = splice(text, place.start, after, [])
      if (rules.length === 1) next = withInlineEmpty(next)
      rules.splice(change.index, 1)
    }
  }
  if (next === undefined) return { refused: NOT_FOUND }
  try {
    if (
      canonical(strictParse(next)) === canonical(intended) &&
      canonical(openDocument(path, next).value()) === canonical(intended)
    )
      return { text: next }
  } catch {
    // fall through
  }
  return { refused: NOT_FOUND }
}
