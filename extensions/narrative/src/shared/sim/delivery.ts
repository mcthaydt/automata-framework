// How a line is said: a direction for the writer (never shown), a pace, and pauses between sentences. Pauses are counted
// by sentence, not marked inside the words, so a translation is plain text and `automata words` and its placeholder check
// need nothing new; every language splits the same way, on the same marks. Pure functions: the box and the caption pass the
// time in, so a replay draws the same frames.
import { z } from 'zod'

/** A pause after a sentence: `after` counts sentences from 1, `pause` in beats (1 short, 2 long). */
export interface Beat {
  readonly after: number
  readonly pause: number
}

export interface Delivery {
  /** A direction for the writer and the actor ("tired, half asleep"); never shown to a player. */
  readonly how?: string | undefined
  /** 1 is normal; above is faster. */
  readonly pace?: number | undefined
  readonly beats?: readonly Beat[] | undefined
}

export const deliverySchema: z.ZodType<Delivery> = z.strictObject({
  how: z.string().optional(),
  pace: z.number().positive().optional(),
  beats: z.array(z.strictObject({ after: z.number().int().min(1), pause: z.number().positive() })).optional(),
})

/** Seconds in a beat. */
export const BEAT_SECONDS = 0.35

/** The marks that end a sentence, in every language: `.`, `!`, `?`, `。`, `！`, `？` and a line break. */
const MARKS = new Set(['.', '!', '?', '。', '！', '？', '\n'])

/** Where each sentence of `words` ends, as an offset (exclusive) after its last mark; the last runs to the end. */
function endsOf(words: string): number[] {
  const ends: number[] = []
  const chars = [...words]
  let offset = 0
  for (let i = 0; i < chars.length; i += 1) {
    offset += (chars[i] as string).length
    const marked = MARKS.has(chars[i] as string)
    if (marked && !MARKS.has(chars[i + 1] ?? '')) ends.push(offset)
  }
  if (words !== '' && ends[ends.length - 1] !== words.length) ends.push(words.length)
  if (ends.length > 0) ends[ends.length - 1] = words.length
  return ends
}

/** The sentences of `words`, trimmed, split the same way for every language. */
export function sentences(words: string): readonly string[] {
  let start = 0
  return endsOf(words)
    .map((end) => {
      const sentence = words.slice(start, end).trim()
      start = end
      return sentence
    })
    .filter((sentence) => sentence !== '')
}

/**
 * What to show `seconds` into a line: how many characters (of the string's UTF-16 units), and whether it is all there. `rate`
 * is characters a second, times the delivery's pace. It stops for each beat after a sentence, but not after the last.
 */
export function typed(
  words: string,
  delivery: Delivery | undefined,
  seconds: number,
  rate: number,
): { readonly shown: number; readonly done: boolean } {
  if (seconds < 0) return { shown: 0, done: words === '' }
  const speed = rate * (delivery?.pace ?? 1)
  const ends = endsOf(words)
  let at = 0
  let start = 0
  for (const [index, end] of ends.entries()) {
    const take = (end - start) / speed
    if (seconds < at + take)
      return { shown: Math.min(end, start + Math.floor((seconds - at) * speed + 1e-9)), done: false }
    at += take
    start = end
    const pause =
      index === ends.length - 1
        ? 0
        : (delivery?.beats ?? []).filter((b) => b.after === index + 1).reduce((sum, b) => sum + b.pause, 0)
    if (seconds < at + pause * BEAT_SECONDS) return { shown: end, done: false }
    at += pause * BEAT_SECONDS
  }
  return { shown: words.length, done: true }
}

/** What is wrong with a line's delivery against its words, as sentences naming the line. */
export function deliveryProblems(
  id: string,
  delivery: Delivery | undefined,
  words: string | undefined,
): string[] {
  if (delivery?.beats === undefined || words === undefined) return []
  const count = sentences(words).length
  return delivery.beats
    .filter((beat) => beat.after > count)
    .map((beat) => `line ${id}: a beat follows sentence ${beat.after}, but its words have only ${count}`)
}
