import { describe, expect, it } from 'vitest'
import type { ContentLevel } from '#src/shared/level-2d/content.schema.ts'
import { autoStacks, objectsOf, tileRows } from '#src/shared/level-2d/tile-cells.ts'

/** A level with one layer of each kind the readers cover. */
function levelWith(layers: ContentLevel['layers']): ContentLevel {
  return {
    format: 'af2d-content',
    version: 1,
    id: 'cave',
    name: 'Cave',
    size: { w: 96, h: 16 },
    background: { color: '#000000', mode: 'fit' },
    fields: {},
    layers,
  }
}

describe('tileRows', () => {
  it('reads tokens with flips and repeat counts, and a dot as an empty cell', () => {
    const level = levelWith([{ def: 'decor', kind: 'tiles', rows: ['.*2 7h 3v*2 0hv'] }])
    expect(tileRows(level, 'decor')).toEqual([
      [
        undefined,
        undefined,
        { tile: 7, flipX: true, flipY: false },
        { tile: 3, flipX: false, flipY: true },
        { tile: 3, flipX: false, flipY: true },
        { tile: 0, flipX: true, flipY: true },
      ],
    ])
  })

  it('names the level, layer, row and token of a bad token', () => {
    const level = levelWith([{ def: 'decor', kind: 'tiles', rows: ['7x'] }])
    expect(() => tileRows(level, 'decor')).toThrow('Level cave, layer decor, row 0: "7x" is not a tile.')
  })

  it('refuses a layer that is not a tiles layer', () => {
    const level = levelWith([{ def: 'collision', kind: 'intgrid', rows: ['1'] }])
    expect(() => tileRows(level, 'collision')).toThrow(
      'Level cave, layer collision: it is an intgrid layer, not a tiles layer.',
    )
  })
})

describe('autoStacks', () => {
  it('reads one grid per depth, depth 0 first', () => {
    const level = levelWith([
      { def: 'ground', kind: 'auto', stack: [{ rows: ['4 .'] }, { rows: ['. 9hv'] }] },
    ])
    expect(autoStacks(level, 'ground')).toEqual([
      [[{ tile: 4, flipX: false, flipY: false }, undefined]],
      [[undefined, { tile: 9, flipX: true, flipY: true }]],
    ])
  })
})

describe('objectsOf', () => {
  it('returns the items of an objects layer in file order', () => {
    const items = [{ id: 'o1', tile: 2, x: 8, y: 8, flipX: false, flipY: true }]
    const level = levelWith([{ def: 'props', kind: 'objects', items }])
    expect(objectsOf(level, 'props')).toEqual(items)
  })
})
