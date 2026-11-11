// The colours a scene's glow can show, for the bloom to ring: a glowing swatch's own step and the two it dims to, and a
// lit window's room, which moves a step either side.
import { describe, expect, it } from 'vitest'
import { glowColours } from '#src/features/world/albedo/glow.ts'
import { ladderOf } from '#src/features/world/albedo/ladder.ts'
import type { WorldPiece } from '#src/features/world/build.ts'

const piece = (surface: string): WorldPiece => ({
  id: surface,
  sector: 'a',
  light: 1,
  part: 'decor',
  mesh: { positions: [], normals: [], indices: [] },
  surface,
})
const glow = (name: string) =>
  name === 'bulb'
    ? { ramp: 'ember' as const, step: 7 }
    : name === 'pane'
      ? { ramp: 'flame' as const, step: 6, interior: true }
      : undefined

describe('glowColours', () => {
  it('is a glowing swatch’s step and the two it dims to', () => {
    const ember = ladderOf({ ramp: 'ember', step: 7 })
    expect(glowColours([piece('bulb')], glow).sort()).toEqual(
      [ember.steps[7], ember.steps[6], ember.steps[5]].sort(),
    )
  })
  it('is a lit window’s steps from three under its base to one over', () => {
    const flame = ladderOf({ ramp: 'flame', step: 6 })
    expect(glowColours([piece('pane')], glow).sort()).toEqual(flame.steps.slice(3, 8).sort())
  })
  it('names each colour once, and none for a swatch that does not glow', () => {
    const colours = glowColours([piece('bulb'), piece('bulb'), piece('wall')], glow)
    expect(new Set(colours).size).toBe(colours.length)
    expect(glowColours([piece('wall')], glow)).toEqual([])
  })
})
