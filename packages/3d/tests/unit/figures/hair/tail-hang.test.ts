import { describe, expect, it } from 'vitest'
import { measure } from '#src/features/figures/body/genes.ts'
import { J, skeletonFromGenes } from '#src/features/figures/body/rig.ts'
import type { Tail } from '#src/features/figures/content/hair.schema.ts'
import { hairStyleSchema } from '#src/features/figures/content/hair.schema.ts'
import { hairParts } from '#src/features/figures/hair/hair-parts.ts'

// FigureBuilder hair/options.test.ts "a low pony", rewritten to AF's outputs: `hang = "down"` ties the pony at the
// nape and lets it fall straight down the back, with no rise and no arc over the crown.

const m = measure({})
const s = skeletonFromGenes(m.genes)
const input = { m, s, hair: 'hair-dark', skin: 'fair', made: {} }
const rope = { r: 0.14, depth: 0.08, plait: 0.25, slant: 0.5, tip: 'blunt' as const, taper: 0.8 }
const pony = (over: Partial<Tail>): Tail => ({
  at: [0, 0.95, -0.35],
  count: 5,
  rope,
  rise: 0.2,
  length: 0.95,
  spread: [0.2, 0.6],
  ...over,
})
const heights = (tail: Tail): { top: number; back: number } => {
  const { parts } = hairParts(input, { pieces: [{ tail }] })
  const ys: number[] = []
  const zs: number[] = []
  for (const p of parts) {
    for (let i = 0; i < p.mesh.positions.length; i += 3) {
      ys.push(p.mesh.positions[i + 1] ?? 0)
      zs.push(p.mesh.positions[i + 2] ?? 0)
    }
  }
  return { top: Math.max(...ys), back: Math.min(...zs) }
}

describe('a low pony (Tail.hang)', () => {
  it('is tied at the nape and rises no higher than its tie, where a high pony arcs over the crown', () => {
    const high = heights(pony({}))
    const low = heights(pony({ at: [0, -0.35, -1], hang: 'down' }))
    expect(low.top).toBeLessThan(high.top - 0.1)
    const head = s.rest[J.head]?.[1] ?? 0
    // Nothing of it stands above the head's middle (the high pony reaches the crown and over it).
    expect(low.top).toBeLessThan(head + 0.13)
  })
  it('falls clear of the back of the head, behind it', () => {
    const low = heights(pony({ at: [0, -0.35, -1], hang: 'down' }))
    const high = heights(pony({}))
    expect(low.back).toBeLessThan(0)
    expect(Number.isFinite(low.back)).toBe(true)
    expect(Number.isFinite(high.back)).toBe(true)
  })
  it('the schema takes "down" and nothing else', () => {
    const style = (hang: unknown) => ({ pieces: [{ tail: { ...pony({}), hang } }] })
    expect(hairStyleSchema.safeParse(style('down')).success).toBe(true)
    expect(hairStyleSchema.safeParse(style('up')).success).toBe(false)
  })
})
