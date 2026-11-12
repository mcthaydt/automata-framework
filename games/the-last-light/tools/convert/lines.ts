// Each line of the prologue gets its words (the English text, byte for byte) and, where the old game said it with a
// direction, a pace or pauses, its `delivery`. The words are the Owner's: never rewritten here.
import { parse, stringify } from 'smol-toml'
import type { Converted, Unexpressed } from './report.ts'

const LINES_PATH = 'content/lines/prologue.toml'

/** How the old game said a line: a direction, a pace, and the line itself with `{.}` (short) and `{..}` (long) pauses. */
export interface OldDelivery {
  readonly [lineId: string]: { readonly how?: string; readonly pace?: number; readonly say?: string }
}

const HEADER =
  "# The prologue's lines: each line's record and its words. They were converted once from the game's prologue at 92e6704\n# (through October's fixture), and this file is now the source: edit it by hand and in Writer.\n"

/** Marks that end a sentence, as `@automata/narrative` splits them. */
const MARKS = new Set(['.', '!', '?', '。', '！', '？', '\n'])

/** How many sentences of `words` are finished before `offset`, and whether `offset` falls inside the next one. */
function sentencesBefore(words: string, offset: number): { done: number; inside: boolean } {
  const chars = [...words]
  let done = 0
  let position = 0
  for (let i = 0; i < chars.length && position < offset; i += 1) {
    position += (chars[i] as string).length
    if (MARKS.has(chars[i] as string) && !MARKS.has(chars[i + 1] ?? '') && position <= offset) done += 1
  }
  const before = chars.slice(0, [...words.slice(0, offset)].length).join('')
  const inside = before.trim() !== '' && !MARKS.has([...before.trimEnd()].pop() ?? '')
  return { done, inside }
}

/** What an old `say` string means as pauses: its plain words, and for each pause the sentence it follows. */
function pausesOf(say: string): {
  plain: string
  pauses: { after: number; pause: number; moved: boolean }[]
  emphasis: number
} {
  let plain = ''
  const marks: { at: number; pause: number }[] = []
  for (let i = 0; i < say.length; ) {
    const rest = say.slice(i)
    const mark = /^\{(\.{1,2})\}/.exec(rest)
    if (mark !== null) {
      marks.push({ at: plain.length, pause: (mark[1] as string).length })
      i += mark[0].length
    } else {
      plain += say[i]
      i += 1
    }
  }
  const emphasis = (plain.match(/[*_][^*_]+[*_]/g) ?? []).length
  const pauses = marks.map(({ at, pause }) => {
    const { done, inside } = sentencesBefore(plain, at)
    return { after: inside ? done + 1 : done, pause, moved: inside }
  })
  return { plain, pauses, emphasis }
}

/** The lines file with `words` joined from the locale, and `delivery` where the old game gave one. */
export function joinWords(lines: string, locale: string, delivery: OldDelivery | undefined): Converted {
  const records = (parse(lines) as { lines: Record<string, unknown>[] }).lines
  const words = parse(locale) as Record<string, string>
  const report: Unexpressed[] = []
  const out = records.map((record) => {
    const id = String(record.id)
    const text = words[String(record.text)]
    if (text === undefined)
      throw new Error(`The line ${id} has no words under "${String(record.text)}" in the locale.`)
    const line: Record<string, unknown> = { ...record, words: text }
    const old = delivery?.[id]
    if (old === undefined) return line
    const given: Record<string, unknown> = {}
    if (old.how !== undefined) given.how = old.how
    if (old.pace !== undefined) given.pace = old.pace
    if (old.say !== undefined) {
      const { plain, pauses, emphasis } = pausesOf(old.say)
      // Pauses are counted by sentence, a pause past the last sentence has nothing to wait for.
      const total = [...text.matchAll(/[.!?。！？\n]+/g)].length
      const beats = pauses
        .filter((p) => p.after >= 1 && p.after < Math.max(total, 1) + 1)
        .map((p) => ({ after: p.after, pause: p.pause }))
      for (const p of pauses)
        if (p.moved)
          report.push({ kind: 'delivery', where: id, what: 'a pause inside a sentence', did: 'approximated' })
      if (emphasis > 0)
        report.push({
          kind: 'delivery',
          where: id,
          what: `${emphasis} emphasis mark(s): the words carry no markup now`,
          did: 'dropped',
        })
      if (plain.replace(/[*_]/g, '') !== text.replace(/[*_]/g, ''))
        report.push({
          kind: 'delivery',
          where: id,
          what: 'the old say-text differs from the locale words; the locale words stand',
          did: 'left-for-hand',
        })
      if (beats.length > 0) given.beats = beats
    }
    if (Object.keys(given).length > 0) line.delivery = given
    return line
  })
  return { files: { [LINES_PATH]: `${HEADER}${stringify({ lines: out })}\n` }, report }
}
