import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { parse } from 'smol-toml'
import { describe, expect, it } from 'vitest'
import { type ContentLevel, levelContentSchema } from '#src/shared/level-2d/content.schema.ts'
import { entitiesOf, intGridRows } from '#src/shared/level-2d/read-level.ts'

const ROOM = fileURLToPath(new URL('./fixtures/room/content/levels/room-1.toml', import.meta.url))
const room = levelContentSchema.parse(parse(readFileSync(ROOM, 'utf8')))

/** The room with its collision layer's rows replaced. */
function withRows(rows: string[]): ContentLevel {
  return {
    ...room,
    layers: room.layers.map((layer) => (layer.def === 'collision' ? { ...layer, rows } : layer)),
  }
}

describe('intGridRows', () => {
  it('reads the room as numbers: 1 solid, 0 empty, one row per row of the file', () => {
    const rows = intGridRows(room, 'collision')
    expect(rows).toHaveLength(24)
    expect(rows[0]).toEqual(Array.from({ length: 40 }, () => 1))
    expect(rows[1]).toEqual([1, ...Array.from({ length: 38 }, () => 0), 1])
    expect(rows[5]?.slice(11, 20)).toEqual([0, 1, 1, 1, 1, 1, 1, 1, 0])
  })

  it('reads a run without a count as one cell, and an empty row as no cells', () => {
    expect(intGridRows(withRows(['1 . 2*2', '']), 'collision')).toEqual([[1, 0, 2, 2], []])
  })

  it('names the level, layer, row and token of a bad token', () => {
    const rows = ['1*3', '1*3', '1*3', 'x*2']
    expect(() => intGridRows(withRows(rows), 'collision')).toThrow(
      'Level room-1, layer collision, row 3: "x*2" is not a number.',
    )
  })

  it('refuses a bad repeat count', () => {
    expect(() => intGridRows(withRows(['1*0']), 'collision')).toThrow(
      'Level room-1, layer collision, row 0: "1*0" has a bad repeat count.',
    )
  })

  it('refuses a layer that is not there, and one that is not an IntGrid', () => {
    expect(() => intGridRows(room, 'nope')).toThrow('Level room-1 has no layer "nope".')
    expect(() => intGridRows(room, 'entities')).toThrow(
      'Level room-1, layer entities: it is an entities layer, not an IntGrid layer.',
    )
  })
})

describe('entitiesOf', () => {
  it('lists the items of an entities layer in file order', () => {
    expect(entitiesOf(room, 'entities').map((item) => [item.def, item.x, item.y])).toEqual([
      ['player-start', 52, 184],
      ['goal', 124, 28],
    ])
  })

  it('refuses a layer that is not there, and one that holds no entities', () => {
    expect(() => entitiesOf(room, 'nope')).toThrow('Level room-1 has no layer "nope".')
    expect(() => entitiesOf(room, 'collision')).toThrow(
      'Level room-1, layer collision: it is an intgrid layer, not an entities layer.',
    )
  })
})
