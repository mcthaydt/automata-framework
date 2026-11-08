// What plays when something happens, read the way the game reads it: top to bottom, and only the first row that fits an
// event plays (the Audio extension's `rowFor`). So a row an earlier row already answers never plays, and the page says
// so and offers to move it up. The events the game can send that no row answers are listed too, to answer or keep quiet.
import type { AudioContent } from '@automata/audio-synth'
import type { ContentEdit } from '@automata/editor/kit/documents'
import { matches } from '@automata/feel'
import { eventWords } from '../../shared/event-words.ts'
import { appendEdits, setOrInsert } from '../../shared/fields.ts'
import type { GameEvent } from '../../shared/game-events.ts'

/** The rows an earlier row answers first, each with the first row that does. */
export function shadowedRows(content: AudioContent): { index: number; by: number }[] {
  const rows = content.event ?? []
  return rows.flatMap((row, index) => {
    const by = rows.slice(0, index).findIndex((earlier) => matches(earlier.on, row.on))
    return by < 0 ? [] : [{ index, by }]
  })
}

/** Why a row never plays, in words: it reads after the row's own "When …". */
export const shadowWords = (answeredBy: string): string =>
  `Never plays: ${eventWords(answeredBy)} above answers first.`

/** A row moved from one place to another, as one change. */
export function moveEventEdits(content: AudioContent, from: number, to: number): ContentEdit[] {
  const row = content.event?.[from]
  if (row === undefined || from === to) return []
  return [
    { keyPath: ['event', from], remove: true },
    { keyPath: ['event'], insert: row, at: to },
  ]
}

/** The game's events that no row of "When things happen" answers. */
export const unanswered = (content: AudioContent, events: readonly GameEvent[]): GameEvent[] =>
  events.filter((each) => !(content.event ?? []).some((row) => matches(row.on, each.id)))

const QUIET = 'Quiet on purpose.'

/** A row that plays nothing for `on`: a reason is required, and starts as plain words to be changed. */
export const keepQuietEdits = (content: AudioContent, on: string): ContentEdit[] =>
  appendEdits(['event'], content.event !== undefined, { on, silent: QUIET })

export const quietReasonEdit = (index: number, before: string, reason: string): ContentEdit =>
  setOrInsert(['event', index, 'silent'], before, reason)
