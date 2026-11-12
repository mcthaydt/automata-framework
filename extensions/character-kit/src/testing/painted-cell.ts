// A painted figure's texels, for a test: the figure builder's own painter in Node, with the kit's wardrobe registered, so a game
// can check what its character wears against the picture and not only against its data (a garment the painter does not know is
// dropped without a word; the picture is where it shows).

import { registerFashion } from '../features/fashion/register-fashion.ts'
import { type CharacterDef, cellOf, Figure, member, SWATCHES } from '../shared/figure-builder/door.ts'

/** The painter's pitch: the builder's own camera looks down 18 degrees whatever the game's does. */
const PITCH = (18 * Math.PI) / 180

export interface PaintedCell {
  /** RGBA, `width` by `height`. */
  readonly painted: Uint8ClampedArray
}

/**
 * `def` standing in its default outfit, seen from `direction` (0 front, 2 its left, 4 back, 6 its right: eighths of a turn) at
 * `density` (1, 2 or 4).
 */
export function paintedCell(def: CharacterDef, direction = 0, density: 1 | 2 | 4 = 2): PaintedCell {
  registerFashion()
  const figure = new Figure(member(def, density))
  figure.update(1 / 60, {
    facing: (direction * Math.PI) / 4,
    moving: false,
    view: { azimuth: 0, pitch: PITCH },
  })
  return { painted: cellOf(figure).painted }
}

/** How many texels of `cell` are one of the four painted colours of `swatch` (the character's own, else the builder's or the kit's). */
export function texelsOfSwatch(def: CharacterDef, cell: PaintedCell, swatch: string): number {
  const paint = def.swatches?.[swatch]?.paint ?? SWATCHES[swatch]?.paint ?? []
  const tones = paint.map((hex) => [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16)))
  let count = 0
  const { painted } = cell
  for (let i = 0; i < painted.length; i += 4) {
    if ((painted[i + 3] ?? 0) === 0) continue
    if (tones.some(([r, g, b]) => r === painted[i] && g === painted[i + 1] && b === painted[i + 2])) count++
  }
  return count
}
