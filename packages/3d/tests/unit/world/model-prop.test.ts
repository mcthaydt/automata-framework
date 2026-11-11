// The `model` prop: a GLB placed as a prop. The builder is renderer-free, so the prop is a stand-in box of the fitted
// size (what shows where the model is not loaded) that names the model; the renderer fits the model to it.
import { describe, expect, it } from 'vitest'
import { buildWorld, type WorldPiece } from '#src/features/world/build.ts'
import { propGenerator } from '#src/features/world/props/prop-generator-registry.ts'
import { isFault, resolveProp } from '#src/features/world/props/resolve.ts'
import type { WorldLibrary } from '#src/features/world/swatches.ts'
import type { AfSector2, PropPlace } from '#src/shared/level/af-sector-2.schema.ts'

const LIB: WorldLibrary = {
  swatches: { oakFloor: {}, plasterWarm: {}, trimWhite: {}, wood: {}, basePrim: {} },
  props: {
    bed: { kind: 'model', model: 'models/bed.glb', size: [1, 0.9, 2], uniform: true, swatch: 'wood' },
  },
}
const level = (props: PropPlace[]): AfSector2 => ({
  format: 'af-sector/2',
  name: 't',
  sectors: [
    {
      id: 'room',
      floor: { z: 0 },
      ceiling: { z: 3 },
      light: 1,
      corners: [
        [0, 0],
        [8, 0],
        [8, 8],
        [0, 8],
      ],
    },
  ],
  props,
})
const propPieces = (props: PropPlace[]): WorldPiece[] =>
  buildWorld(level(props), LIB).pieces.filter((p) => p.part === 'prop')

describe('the model prop generator', () => {
  it('is a core kind', () => {
    expect(propGenerator('model')).toBeDefined()
    expect(isFault(resolveProp({ kind: 'model', with: { model: 'a.glb' } }, LIB))).toBe(false)
  })
  it('draws a stand-in box of the fitted size, base centre at the prop’s origin', () => {
    const [piece] = propPieces([{ id: 'bed1', use: 'bed', at: [4, 4], angle: 90 }])
    const xs = (piece as WorldPiece).mesh.positions.filter((_, i) => i % 3 === 0)
    const ys = (piece as WorldPiece).mesh.positions.filter((_, i) => i % 3 === 1)
    expect([Math.min(...xs), Math.max(...xs)]).toEqual([3.5, 4.5])
    expect([Math.min(...ys), Math.max(...ys)]).toEqual([0, 0.9])
    expect((piece as WorldPiece).surface).toBe('wood')
  })
  it('names the model, its fit and the turn it was placed with, for the renderer', () => {
    const [piece] = propPieces([
      { id: 'bed1', use: 'bed', at: [4, 4, 0.2], angle: 0, with: { mirror: true, gain: 1.3 } },
    ])
    expect((piece as WorldPiece).model).toEqual({
      file: 'models/bed.glb',
      size: [1, 0.9, 2],
      uniform: true,
      mirror: true,
      gain: 1.3,
      turn: 90,
    })
    expect((piece as WorldPiece).prop?.at).toEqual([4, 0.2, 4])
  })
  it('stands a wall prop in its wall’s cut group, and flags a ceiling prop', () => {
    const [wall, ceiling] = propPieces([
      {
        id: 'clock',
        kind: 'model',
        at: [1, 1, 2],
        with: { model: 'clock.glb', size: [0.5, 0.5, 0.1], wall: 'north' },
      },
      {
        id: 'strip',
        kind: 'model',
        at: [2, 2, 3],
        with: { model: 'strip.glb', size: [0.3, 0.1, 1.2], ceiling: true },
      },
    ]) as [WorldPiece, WorldPiece]
    expect(wall.cut).toBe('north')
    expect(ceiling.ceiling).toBe(true)
    expect(wall.ceiling).toBeUndefined()
  })
  it('draws a box when it names no model, so a prop never goes missing', () => {
    const [piece] = propPieces([{ id: 'x', kind: 'model', at: [1, 1], with: { size: [1, 1, 1] } }])
    expect((piece as WorldPiece).model).toBeUndefined()
    expect((piece as WorldPiece).mesh.positions.length).toBeGreaterThan(0)
  })
})
