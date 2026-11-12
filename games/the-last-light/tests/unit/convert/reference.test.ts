import { describe, expect, it } from 'vitest'
import { deliveryIn, evaluate, placedModelsIn } from '../../../tools/convert/reference.ts'

describe('evaluate', () => {
  it('does sums, products, constants and names without eval', () => {
    expect(evaluate('Math.PI / 2')).toBeCloseTo(1.5707963)
    expect(evaluate('WALL_FACE.niche + 0.24', { 'WALL_FACE.niche': -5.225 })).toBeCloseTo(-4.985)
    expect(evaluate('-Math.PI / 2')).toBeCloseTo(-1.5707963)
    expect(evaluate('2 * (3 + 4)')).toBe(14)
  })
  it('refuses what it cannot read, naming it', () => {
    expect(() => evaluate('process.exit()')).toThrow(/process/)
  })
})

const LEVEL = `export const BOXES: Box[] = [
  { id: 'bed', x: -4.1, z: 0.4, y: 0.4, w: 1.4, h: 0.8, d: 2.1, kind: 'bed' },
  { id: 'sink', x: -4.97, z: 3, y: 0.5, w: 0.5, h: 1, d: 0.7, kind: 'furniture' },
];`
const PROPS = `export const WALL_FACE = { west: -4.875, niche: -5.225 };
export const PROPS: PropSpec[] = [
  { file: 'bed', ...at('bed'), size: [1.05, 0.95, 2.05], uniform: true, hotspot: 'bed' },
  // a comment
  { file: 'sink', ...at('sink'), x: WALL_FACE.niche + 0.24, y: 0.2, yaw: Math.PI / 2, size: [0.45, 0.8, 0.51], uniform: true },
  ...stock('north', 3.72, -6.17, [['stock-boxes', 0.14, 0.4], ['stock-linen', 1.12, 0.3]]),
];`

describe('placedModelsIn', () => {
  it('reads a model on a box, a model with its own place, and a shelf’s stock', () => {
    const models = placedModelsIn(PROPS, LEVEL)
    expect(models).toHaveLength(4)
    expect(models[0]).toMatchObject({
      file: 'bed',
      x: -4.1,
      z: 0.4,
      size: [1.05, 0.95, 2.05],
      collider: 'bed',
    })
    expect(models[1]).toMatchObject({ file: 'sink', z: 3, y: 0.2 })
    expect(models[1]?.x).toBeCloseTo(-4.985)
    expect(models[1]?.yaw).toBeCloseTo(Math.PI / 2)
    expect(models[2]).toMatchObject({
      file: 'stock-boxes',
      x: 3.72,
      z: -6.17,
      y: 0.16,
      size: [0.3, 0.4, 0.3],
    })
  })
  it('refuses a model on a box the level lacks, naming it', () => {
    expect(() => placedModelsIn(PROPS, 'export const BOXES = [];')).toThrow(/"bed"/)
  })
})

describe('deliveryIn', () => {
  it('reads how, pace and say of each line', () => {
    const table = deliveryIn(`export const DELIVERY = {
  'prologue.monitor': { how: 'convincing herself', pace: 1.25, say: 'Good. Fine.{.} Good.' },
  'prologue.keypadWrong': { how: 'annoyed at herself', pace: 1.25 },
};`)
    expect(table['prologue.monitor']).toEqual({
      how: 'convincing herself',
      pace: 1.25,
      say: 'Good. Fine.{.} Good.',
    })
    expect(table['prologue.keypadWrong']).toEqual({ how: 'annoyed at herself', pace: 1.25 })
  })
})
