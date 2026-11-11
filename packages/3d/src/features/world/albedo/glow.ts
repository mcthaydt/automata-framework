// What a glowing swatch (a bulb, a neon, a lit window) needs of its library entry: its ladder, and whether the room behind
// it is shown (`interior`). A prop's glowing parts dim with the prop's own lamps.
import type { WorldPiece } from '../build.ts'
import { tileName } from '../surface.ts'
import { type LadderSwatch, ladderOf, STEPS } from './ladder.ts'

export interface GlowSwatch extends LadderSwatch {
  /** A lit window: the glass shows a room behind it. */
  readonly interior?: boolean | undefined
}

/** The id of a prop's n-th lamp: the builder names it so, and a glow finds its lamps by it. */
export const propLampId = (prop: string, n: number): string => `${prop}.light${n}`

/** The ids among `lamps` that are lamps of `prop`. */
export const lampsOfProp = (lamps: readonly { readonly id: string }[], prop: string): string[] =>
  lamps
    .filter((lamp) => lamp.id.startsWith(`${prop}.light`) && /^\d+$/.test(lamp.id.slice(prop.length + 6)))
    .map((lamp) => lamp.id)

/**
 * Every colour a scene's glow can show: a glowing swatch's own step and the two it dims to (`glowDim`), and a lit window's
 * room, from three steps under its base to one over (what `interiorStep` returns). It is the bloom's mask: a pixel of one
 * of these colours is something that glows. Each colour once, as `0xRRGGBB`.
 */
export function glowColours(
  pieces: readonly Pick<WorldPiece, 'surface'>[],
  glow: (swatch: string) => GlowSwatch | undefined,
): number[] {
  const colours = new Set<number>()
  for (const { surface } of pieces) {
    const swatch = glow(tileName(surface))
    if (swatch === undefined) continue
    const ladder = ladderOf(swatch)
    const [low, high] = swatch.interior === true ? [-3, 1] : [-2, 0]
    for (let step = ladder.base + low; step <= ladder.base + high; step++)
      colours.add(ladder.steps[Math.max(0, Math.min(STEPS - 1, step))] as number)
  }
  return [...colours]
}
