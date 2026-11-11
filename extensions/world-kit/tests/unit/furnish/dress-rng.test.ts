// The dresser draws from EnvironmentBuilder's seeded generator (mulberry32), so the same kit and seed place the same pieces.
import { describe, expect, it } from 'vitest'
import { dressedBaseScenes } from '#src/app/dressed-base-scenes.ts'
import { mulberry32 } from '#src/features/furnish/mulberry.ts'

describe('the dresser’s generator', () => {
  it('is mulberry32: seed 7919 starts the sequence EnvironmentBuilder’s does', () => {
    const next = mulberry32(7919)
    expect([next(), next(), next()]).toEqual([0.6900994984898716, 0.7416439699009061, 0.37708328501321375])
  })

  it('treats seed 0 as 1, as EnvironmentBuilder’s does', () => {
    expect(mulberry32(0)()).toBe(mulberry32(1)())
  })
})

// What EnvironmentBuilder's dresser places for the base scenes' kits at seed 1 (its `dress()` on `BASE_SCENES`, run on
// its main). This file imports the scenes alone: they must not depend on the caller having registered the kit's props
// first, or every footprint quietly falls back to half a metre and the pieces land elsewhere.
const placed = (name: 'base-exterior-dressed' | 'base-interior-dressed') =>
  (dressedBaseScenes[name].props ?? []).filter((p) => p.id?.includes(':'))

describe('the dressed base scenes place what EnvironmentBuilder’s do', () => {
  it('the street: a bench, bin and planter along the facade, and two cable runs', () => {
    const at = (use: string) =>
      placed('base-exterior-dressed')
        .filter((p) => p.use === use)
        .map((p) => [p.id, p.at])
    expect(at('bench')).toEqual([['pavement:furniture:0', [-6.45, -2.75]]])
    expect(at('bin')).toEqual([['pavement:furniture:1', [-0.05, -2.704]]])
    expect(at('planter')).toEqual([['pavement:furniture:2', [-3.65, -2.78]]])
    expect(at('cable.run')).toEqual([
      ['pavement:fixture:0', [-5.5, -2.99, 2.72]],
      ['pavement:fixture:1', [4.5, -2.99, 2.72]],
    ])
  })

  it('the waiting room: three chair rows, a round table and a plant in the corner', () => {
    const furniture = placed('base-interior-dressed').filter((p) => p.id?.includes(':furniture:'))
    expect(furniture.map((p) => [p.use, p.at, p.angle]).slice(0, 4)).toEqual([
      ['chair.row', [2.766, 1.55], 180],
      ['chair.row', [-2.766, -0.35], 0],
      ['chair.row', [-1.45, -2.266], 90],
      ['table.round', [1, 0], 90],
    ])
    // The plant's blades are drawn from AF's own stream, not EnvironmentBuilder's, so its footprint (and so its corner
    // spot) is a few centimetres off; which piece and which way it faces are the same.
    expect(furniture.slice(4).map((p) => [p.use, p.angle])).toEqual([['plant.fronds', -90]])
  })
})
