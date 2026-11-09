import { describe, expect, it } from 'vitest'
import { fabricOf, labelAt, registerFabric } from '#src/features/figures/paint/fabric.ts'
import { FIXTURES, registerFixtures } from './fabric-fixtures.ts'

describe('the fabric registry', () => {
  it('rejects a deep motif', () => {
    expect(() => registerFabric('deep', { w: 2, h: 2, labels: [0, -2, 0, 0] })).toThrow(/motif/)
  })
  it('rejects a wrong number of labels', () => {
    expect(() => registerFabric('short', { w: 3, h: 3, labels: [0] })).toThrow(/labels/)
  })
  it('rejects a non-integer label', () => {
    expect(() => registerFabric('half', { w: 2, h: 1, labels: [0, -0.5] })).toThrow()
  })
  it('rejects a pattern label above +1', () => {
    expect(() => registerFabric('loud', { w: 8, h: 1, labels: [0, 2, 0, 0, 0, 0, 0, 0] })).toThrow()
  })
  it('accepts a pattern from -2 to +1, and returns it', () => {
    registerFabric('photo', { w: 8, h: 1, labels: [-2, -1, 0, 1, 0, 0, 0, 0] })
    expect(fabricOf('photo')?.labels).toEqual([-2, -1, 0, 1, 0, 0, 0, 0])
  })
  it('rejects a motif with a +1 and a 4×4 at -2, and accepts a 5×4 at -2', () => {
    expect(() => registerFabric('edge-plus', { w: 2, h: 2, labels: [0, 1, 0, 0] })).toThrow(/motif/)
    expect(() => registerFabric('edge-44', { w: 4, h: 4, labels: [-2, ...new Array(15).fill(0)] })).toThrow(
      /motif/,
    )
    registerFabric('edge-54', { w: 5, h: 4, labels: [-2, ...new Array(19).fill(0)] })
    expect(fabricOf('edge-54')?.labels[0]).toBe(-2)
  })
  it('rejects a tile of no metres and a tile of no width', () => {
    expect(() => registerFabric('edge-m0', { w: 2, h: 1, labels: [0, -1], metres: 0 })).toThrow(/metres/)
    expect(() => registerFabric('edge-w0', { w: 0, h: 1, labels: [] })).toThrow(/whole numbers/)
  })
  it('rejects a taken name', () => {
    expect(() => registerFabric('photo', { w: 1, h: 1, labels: [0] })).toThrow(/registered/)
  })
  it('registers the fixtures twice without throwing, and the twill is one step deep', () => {
    registerFixtures()
    registerFixtures()
    expect(new Set(fabricOf('fx-twill')?.labels)).toEqual(new Set([0, -1]))
    expect(FIXTURES.check.labels.length).toBe(64)
  })
  it('labelAt reads a texel-size tile, with positive mods', () => {
    expect(labelAt(FIXTURES.rib, 1.5 / 73.8, 0, 73.8)).toBe(-1)
    expect(labelAt(FIXTURES.rib, -0.5 / 73.8, 0, 73.8)).toBe(-1)
    expect(labelAt(FIXTURES.rib, 0.5 / 73.8, 0, 73.8)).toBe(0)
  })
  it('labelAt keeps a physical-size tile at its metres', () => {
    const f = { ...FIXTURES.rib, metres: 0.01 }
    expect(labelAt(f, 0.015, 0, 73.8)).toBe(-1)
    expect(labelAt(f, 0.015, 0, 147.6)).toBe(-1)
  })
})
