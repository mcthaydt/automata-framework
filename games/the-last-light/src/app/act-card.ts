import type { CutsceneStateValue } from '@automata/cutscenes/sim'

// The card the old game puts over the start of an act (`ACT_CARD` in `src/main.ts` and `actCard` in `src/game/presentation.ts` at
// 92e6704): "PROLOGUE: FIRST NIGHT", up a second into the opening cutscene and gone at four and a half, so it is never across Ada's
// face (the opening's first shot is held on the empty hall until 4.6 s). The words are the interface's (`card.prologue`).

/** Which cutscene carries the card, from and to which second of it, and the words' key. */
export const ACT_CARD = { cutscene: 'opening', from: 1, to: 4.5, words: 'card.prologue' } as const

/** The sim steps a second is: the sim runs at 60 a second. */
const STEPS_A_SECOND = 60

/** Whether the card is up at sim step `tick`, by the cutscene's own clock (the step it began on), so a slow renderer shows it as long as a fast one. */
export function cardAt(state: Pick<CutsceneStateValue, 'id' | 'start'>, tick: number): boolean {
  if (state.id !== ACT_CARD.cutscene) return false
  const seconds = (tick - state.start) / STEPS_A_SECOND
  return seconds >= ACT_CARD.from && seconds < ACT_CARD.to
}
