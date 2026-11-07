import { describe, expect, it } from 'vitest'
import { measure } from '#src/features/figures/body/genes.ts'
import { skeletonFromGenes } from '#src/features/figures/body/rig.ts'
import { type Bun, hairStyleSchema } from '#src/features/figures/content/hair.schema.ts'
import { hairParts } from '#src/features/figures/hair/hair-parts.ts'

// FigureBuilder hair/options.test.ts "a bun", rewritten to AF's outputs: one rope wound in a flattened spiral on the
// skull in the direction `at`, `flat` of its width deep (default 0.6), `turns` round (default 2.5).

const m = measure({})
const s = skeletonFromGenes(m.genes)
const input = { m, s, hair: 'hair-dark', skin: 'fair', made: {} }
const rope = { r: 0.16, tip: 'round' as const }
const bun = (over: Partial<Bun> = {}): Bun => ({ at: [0, -0.35, -1], r: 0.5, rope, ...over })
/** How far the bun's rope reaches along the z axis (it is tied at the nape, so back is -z): the bun's depth off the head. */
const depth = (b: Bun): number => {
  const { parts } = hairParts(input, { pieces: [{ bun: b }] })
  const zs = parts.flatMap((p) => p.mesh.positions.filter((_, i) => i % 3 === 2))
  return Math.min(...zs)
}

describe('a bun', () => {
  it('lies flatter the lower its flat, standing less far off the head', () => {
    expect(depth(bun({ flat: 0.2 }))).toBeGreaterThan(depth(bun({ flat: 1 })))
  })
  it('defaults to flat 0.6 and 2.5 turns', () => {
    expect(depth(bun())).toBeCloseTo(depth(bun({ flat: 0.6, turns: 2.5 })), 12)
  })
  it('more turns are more rope, so more of it', () => {
    const count = (b: Bun) => hairParts(input, { pieces: [{ bun: b }] }).parts[0]?.mesh.positions.length ?? 0
    expect(count(bun({ turns: 4 }))).toBeGreaterThan(count(bun({ turns: 1.5 })))
  })
  it('the schema takes flat, and turns may be left out', () => {
    const style = (b: object) => ({ pieces: [{ bun: b }] })
    expect(hairStyleSchema.safeParse(style({ at: [0, -0.35, -1], r: 0.5, rope, flat: 0.4 })).success).toBe(
      true,
    )
    expect(hairStyleSchema.safeParse(style({ at: [0, -0.35, -1], r: 0.5, rope })).success).toBe(true)
  })
})
