// Narrative lint: a scene's line records and beats against the canon and the
// house rules. Pure. The text a record shows is the locale's: a record's `text` is a key, and a key with no
// text is an error. Line length is checked only with a game's `measure` and box.

import type { Beat } from '../../shared/beats.schema'
import type { Canon } from '../../shared/sim/canon.schema'
import type { LineKind, LineRecord } from '../../shared/sim/lines.schema'
import { collect, type Finding } from './finding'

/** Width in pixels of `text` set in the CSS `font`. A game supplies it (a canvas, a font table). */
export type Measure = (text: string, font: string) => number
/** Where a line is shown: how wide, in which font, and how many lines it may take. */
export interface Box {
  readonly width: number
  readonly font: string
  readonly lines: number
}
/** A game's boxes by line kind, with the one every other kind uses. */
export type Boxes = Readonly<Partial<Record<LineKind | 'default', Box>>>

export interface LintInput {
  readonly canon: Canon
  readonly records: readonly LineRecord[]
  /** The locale's text, by line key. */
  readonly text: Readonly<Record<string, string>>
  readonly beats?: readonly Beat[] | undefined
  readonly measure?: Measure | undefined
  readonly boxes?: Boxes | undefined
  /** Record ids the game uses; when given, every other record is reported unused. */
  readonly used?: ReadonlySet<string> | undefined
}

/** Lines `text` wraps to at `width` (greedy, on spaces; `\n` breaks). */
export function wrap(text: string, width: number, font: string, measure: Measure): number {
  let count = 0
  for (const paragraph of text.split('\n')) {
    let current = ''
    count++
    for (const word of paragraph.split(' ')) {
      const next = current ? `${current} ${word}` : word
      if (current && measure(next, font) > width) {
        count++
        current = word
      } else current = next
    }
  }
  return count
}

const words = (s: string): string[] =>
  s
    .split(/[\s/]+/)
    .map((w) => w.replace(/^[^\p{L}\d]+|[^\p{L}\d.]+$/gu, '').replace(/\.$/, ''))
    .filter(Boolean)
/** Every word a proper noun may be: the glossary, people, places, and their parts. */
function vocabulary(canon: Canon): Set<string> {
  const terms = [
    ...canon.glossary,
    ...Object.values(canon.people).flatMap((p) => [p.name, p.short ?? '']),
    ...Object.values(canon.places),
  ]
  return new Set(
    terms
      .flatMap(words)
      .map((w) => w.toLowerCase())
      .concat(['i']),
  )
}
/** Sentences, split on . ? ! … : and quotes, without splitting `St.`, `Mr.` or initials like `A.`. */
function sentences(line: string): string[] {
  const guarded = line.replace(/\b(St|Mr|Mrs|Dr|[A-Z])\./g, '$1\uE000')
  return guarded
    .split(/(?<=[.?!…:"“])\s+|["“”]/)
    .map((s) => s.replace(/\uE000/g, '.').trim())
    .filter(Boolean)
}
/** Capitalised words that are not at the start of a sentence, and every all-caps word, unless the whole sentence is in capitals (a document line). */
export function properNouns(text: string): string[] {
  const found: string[] = []
  for (const line of text.split('\n'))
    for (const sentence of sentences(line)) {
      if (!/\p{Ll}/u.test(sentence)) continue
      sentence.split(/\s+/).forEach((raw, i) => {
        // A contraction or possessive is its word: I’m, I’ll, Porter’s.
        const word = raw
          .replace(/^[^\p{L}]+|[^\p{L}.]+$/gu, '')
          .replace(/\.$/, '')
          .replace(/['’](s|m|ll|d|ve|re)$/u, '')
        if (!word || !/^\p{Lu}/u.test(word)) return
        const caps = word.length > 1 && !/\p{Ll}/u.test(word)
        if (caps || i > 0) found.push(word)
      })
    }
  return found
}

const escapeRe = (w: string): string => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export function lintNarrative(input: LintInput): Finding[] {
  const { canon, records } = input
  const { findings, add } = collect()
  const facts = new Set(canon.facts.map((f) => f.id))
  const times = Object.values(canon.times).join(' ')
  const vocab = vocabulary(canon)
  const banned = canon.tone.banned.map((w) => ({ w, re: new RegExp(`\\b${escapeRe(w)}\\b`, 'i') }))
  const beats = new Map((input.beats ?? []).map((b) => [b.id, b]))
  const byText = new Map<string, string>()
  for (const r of records) {
    for (const f of r.facts ?? []) if (!facts.has(f)) add('error', 'fact', r.id, `unknown fact '${f}'`)
    const text = input.text[r.text]
    if (text === undefined) {
      add('error', 'text', r.id, `the locale has no text for ${r.text}`)
      continue
    }
    for (const t of text.match(/\b\d\d:\d\d\b/g) ?? [])
      if (!times.includes(t)) add('error', 'time', r.id, `${t} is not a canon time`)
    for (const noun of properNouns(text))
      if (!vocab.has(noun.toLowerCase()))
        add('error', 'noun', r.id, `'${noun}' is not canon or in the glossary`)
    for (const { w, re } of banned) if (re.test(text)) add('error', 'tone', r.id, `banned word '${w}'`)
    if (text.includes('!')) add('error', 'exclamation', r.id, 'no exclamation marks (canon tone)')
    const box = input.boxes?.[r.kind] ?? input.boxes?.default
    if (input.measure !== undefined && box !== undefined) {
      const lines = wrap(text, box.width, box.font, input.measure)
      if (lines > box.lines)
        add('error', 'length', r.id, `${lines} lines at ${box.width} px (${box.font}); at most ${box.lines}`)
    }
    const twin = byText.get(text)
    if (twin !== undefined) add('error', 'duplicate', r.id, `same text as ${twin}`)
    else byText.set(text, r.id)
    const beat = r.beat === undefined ? undefined : beats.get(r.beat)
    if (r.beat !== undefined && input.beats !== undefined) {
      if (beat === undefined) add('error', 'beat', r.id, `unknown beat '${r.beat}'`)
      else if (!beat.deliveredBy.includes(r.id))
        add('error', 'beat', r.id, `beat '${r.beat}' does not list this line in deliveredBy`)
    }
    if (input.used !== undefined && !input.used.has(r.id))
      add('error', 'unused', r.id, 'nothing in the game uses this line')
  }
  const ids = new Set(records.map((r) => r.id))
  for (const b of input.beats ?? []) {
    if (b.deliveredBy.length === 0) add('error', 'beat', b.id, 'delivered by no line')
    for (const id of b.deliveredBy)
      if (!ids.has(id)) add('error', 'beat', b.id, `deliveredBy names unknown line ${id}`)
    for (const a of b.after ?? [])
      if (!beats.has(a)) add('error', 'beat', b.id, `after names unknown beat ${a}`)
  }
  return findings
}
