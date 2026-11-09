// The oracle frames as the painter's input: the JSON the oracle script wrote, with its sets and typed arrays restored.

import { createHash } from 'node:crypto'
import type { CellInput } from '#src/features/figures/paint/paint-cell.ts'
import type { OracleFrame } from '#src/testing/oracles.ts'

/** The md5 of a cell's texels, an empty texel's colour (which nothing reads) taken as black, as the oracle hashes them. */
export function md5(colours: Uint8ClampedArray): string {
  const out = colours.slice()
  for (let o = 0; o < out.length; o += 4) if (out[o + 3] === 0) out[o] = out[o + 1] = out[o + 2] = 0
  return createHash('md5').update(out).digest('hex')
}

export function inputOf(frame: OracleFrame): CellInput {
  const face =
    frame.face === null ? null : { ...frame.face, mood: new Set<string>((frame.face.mood as string[]) ?? []) }
  return {
    soup: frame.soup,
    decals: frame.decals as CellInput['decals'],
    materials: frame.materials as CellInput['materials'],
    face: face as CellInput['face'],
    hands: frame.hands as unknown as CellInput['hands'],
    bends: frame.bends as CellInput['bends'],
    cell: frame.cell,
    feet: frame.feet,
    metres: frame.metres,
    neck: new Set(frame.neck),
    skin: frame.skin,
  }
}

/** The frames FigureBuilder painted with one eye (its sunglasses check counted the ear as shades). */
export const f13Frames = (frames: readonly OracleFrame[]): ReadonlySet<string> =>
  new Set(frames.filter((f) => f.f13).map((f) => f.id))

/** How many of the face's two eyes show a mark of the drawn eye (iris, lash or white) within a texel box of where it goes. */
export function eyesIn(
  colours: Uint8ClampedArray,
  width: number,
  face: NonNullable<CellInput['face']>,
  /** The cell's density: the eye is drawn on the texel grid of its density, so it may sit this many rows off the projected point. */
  reach = 1,
): number {
  if (Math.abs(face.view) > 1) return 0
  const marks = new Set<number>([face.iris, face.lash, face.white])
  let seen = 0
  for (const [ex, ey] of face.eyes) {
    let found = false
    for (let y = Math.round(ey) - reach; y <= Math.round(ey) + reach && !found; y++)
      for (let x = Math.round(ex) - 2 * reach; x <= Math.round(ex) + 2 * reach && !found; x++) {
        const o = (y * width + x) * 4
        if (colours[o + 3] === 0) continue
        if (marks.has(((colours[o] ?? 0) << 16) | ((colours[o + 1] ?? 0) << 8) | (colours[o + 2] ?? 0)))
          found = true
      }
    if (found) seen++
  }
  return seen
}
