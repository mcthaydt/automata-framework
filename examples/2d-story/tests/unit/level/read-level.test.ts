import { levelContentSchema } from '@automata/content/level-2d'
import { describe, expect, it } from 'vitest'
import { LEVEL } from '../../../src/features/level/level.ts'
import { levelOf, SOLID } from '../../../src/features/level/read-level.ts'

// A level as the editor exports it, cut down: 4 cells wide on a 16 px grid, a floor, and the player start on it.
const small = (items: { id: string; def: string; x: number; y: number }[]) =>
  levelContentSchema.parse({
    format: 'af2d-content',
    version: 1,
    id: 'small',
    name: 'Small',
    size: { w: 64, h: 32 },
    background: { color: '#000000', mode: 'fit' },
    fields: {},
    layers: [
      { def: 'entities', kind: 'entities', items: items.map((item) => ({ ...item, fields: {} })) },
      { def: 'collision', kind: 'intgrid', rows: ['.*4', '1*4'] },
    ],
  })

describe('reading a level', () => {
  it('reads its size, walls and player start', () => {
    const level = levelOf(small([{ id: '1', def: 'player-start', x: 24, y: 16 }]))
    expect(level).toMatchObject({ width: 64, height: 32, tile: 16, start: { x: 24, y: 16 } })
    expect(level.cells).toEqual([
      [0, 0, 0, 0],
      [SOLID, SOLID, SOLID, SOLID],
    ])
  })

  it('needs exactly one player start', () => {
    expect(() => levelOf(small([]))).toThrow('needs one player start')
  })

  it("reads the game's own level, with the start inside it", () => {
    expect(LEVEL.start.x).toBeGreaterThan(0)
    expect(LEVEL.start.x).toBeLessThan(LEVEL.width)
    expect(LEVEL.start.y).toBeLessThanOrEqual(LEVEL.height)
  })
})
