// G3-d and G3-F1 (DESIGN.md §19): each move's clip, retimed to the move's `total` frames, shows its `contact` marker on
// the move's first active frame, within one tick, so the sword meets the target when the sim's hit window opens.
// A content check on the compiled clips (content.test.ts); presentation code, outside the sim.
import type { FigureClipDef } from '@mcthaydt/automata-figures'
import { type MoveDef, TICK_HZ } from '../constants.ts'

/**
 * One line per problem, naming the move and its clip: a clip that does not exist, a sword move's clip with no
 * `contact`, or a `contact` that, retimed from the clip's length to the move's `total` ticks, lands more than a tick
 * from the active start (frame `active[0]` shows on tick `active[0] − 1` from the move's start). Empty when every move
 * holds.
 */
export function moveClipProblems(
  moves: readonly MoveDef[],
  clips: Readonly<Record<string, FigureClipDef | undefined>>,
): string[] {
  const problems: string[] = []
  for (const move of moves) {
    const id = move.clip ?? move.id
    const clip = clips[id]
    const named = `move "${move.id}": its clip "${id}"`
    if (clip === undefined) {
      problems.push(`${named} does not exist`)
      continue
    }
    if (move.hit === undefined) continue
    const contact = clip.markers?.contact
    if (contact === undefined) {
      problems.push(`${named} has no \`contact\` marker`)
      continue
    }
    const tick = (contact / clip.length) * move.total
    const expected = move.active[0] - 1
    if (Math.abs(tick - expected) > 1)
      problems.push(
        `${named} shows \`contact\` on tick ${Math.round(tick)}, not ${expected} (±1): ${contact} s of ${clip.length} s, retimed to ${move.total / TICK_HZ} s`,
      )
  }
  return problems
}
