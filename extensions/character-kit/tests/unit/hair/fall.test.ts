import { hairStyleSchema, J, measure, skeletonFromGenes } from '@automata/3d/figures'
import { hairParts } from '@automata/3d/figures-kit'
import { describe, expect, it } from 'vitest'
import '#src/features/hair/register-hair.ts'

// Loose hair (`fall`): clumps from the crown over the scalp to the hairline and straight down to `length`, a wave or a
// spiral by `curl`, standing off the skull by `volume`.

const m = measure({})
const s = skeletonFromGenes(m.genes)
const input = { m, s, hair: 'hair-dark', skin: 'fair', made: {} }
const HAIRLINE = [
  [0, 0.6],
  [0.8, 0.36],
  [1.5, 0.2],
  [2.4, -0.4],
  [3.1416, -0.55],
]
const fall = (extra: Record<string, unknown> = {}) => ({
  fall: { from: HAIRLINE, part: 0, count: 14, length: 1, curl: 0, volume: 0, rope: { r: 0.14 }, ...extra },
})
/** The hair's vertices in the figure's rest space: its skinned parts are, and a rigid one is in the head's. */
const verts = (piece: object): number[][] => {
  const head = s.rest[J.head] ?? [0, 0, 0]
  const out: number[][] = []
  for (const p of hairParts(input, { pieces: [piece] } as never).parts)
    for (let i = 0; i < p.mesh.positions.length; i += 3)
      out.push(
        p.skin
          ? [p.mesh.positions[i] ?? 0, p.mesh.positions[i + 1] ?? 0, p.mesh.positions[i + 2] ?? 0]
          : [
              (p.mesh.positions[i] ?? 0) + head[0],
              (p.mesh.positions[i + 1] ?? 0) + head[1],
              (p.mesh.positions[i + 2] ?? 0) + head[2],
            ],
      )
  return out
}
const lowest = (piece: object): number => Math.min(...verts(piece).map((v) => v[1] ?? 0))
const widest = (piece: object): number => Math.max(...verts(piece).map((v) => Math.abs(v[0] ?? 0)))

describe('loose hair (fall: from, count, length, curl, volume)', () => {
  it('hangs below the chin, further for a longer length', () => {
    expect(lowest(fall({ length: 0 }))).toBeLessThan(s.chinY + 0.02)
    expect(lowest(fall({ length: 1 }))).toBeLessThan(lowest(fall({ length: 0.3 })) - 0.05)
  })
  it('never reaches past the chest', () => {
    expect(lowest(fall({ length: 5 }))).toBeGreaterThan(s.chestY - 0.05)
  })
  it('curls shorter than straight hair', () => {
    expect(lowest(fall({ curl: 1, length: 0.8 }))).toBeGreaterThan(lowest(fall({ curl: 0, length: 0.8 })))
  })
  it('stands further off the skull with volume', () => {
    expect(widest(fall({ volume: 1, length: 0 }))).toBeGreaterThan(
      widest(fall({ volume: 0, length: 0 })) + 0.03,
    )
  })
  it('the schema takes loose hair, refuses a bad number, and no longer takes a list of locks', () => {
    const style = (p: object) => ({ pieces: [{ fall: p }] })
    const rope = { r: 0.14 }
    expect(
      hairStyleSchema.safeParse(style({ from: HAIRLINE, count: 12, length: 1, curl: 0.5, rope })).success,
    ).toBe(true)
    expect(
      hairStyleSchema.safeParse(style({ from: HAIRLINE, count: 12, length: 1, curl: 'x', rope })).success,
    ).toBe(false)
    // The older list of hanging locks is the `strands` piece.
    expect(
      hairStyleSchema.safeParse(style({ at: [[0.5, 0.5, -0.5]], lift: 0.03, plumb: -0.5, rope: { r: 0.1 } }))
        .success,
    ).toBe(false)
  })
})
