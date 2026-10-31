// The dungeon pieces as area entities (DESIGN.md §10, GAME-3D.1f part 1): af-sector/1's `{ def, id, x, z, ...fields }`,
// one schema a definition, and a load error naming the area and the JSON path for anything the game cannot place
// (G3-F2).
import { describe, expect, it } from 'vitest'
import { metres } from '../constants/index.ts'
import { FIRST_SLICE } from '../content/first-slice.ts'
import { AreaLoadError, type AreaSource, compileArea } from './index.ts'

/** The first slice with `entities`: its rooms are the views `hall` and `kiln`. */
const withEntities = (entities: AreaSource['entities']): AreaSource => ({ ...FIRST_SLICE, entities })

/** One good entity of every definition part 1 knows, wired to each other. */
const EVERY_DEF: NonNullable<AreaSource['entities']> = [
  { def: 'switch', id: 'plate-1', x: 0, z: 1, kind: 'plate', latch: true, targets: ['door-1'] },
  { def: 'door', id: 'door-1', x: 0, z: 4, lock: 'switch', switch: 'plate-1', width: 2, depth: 0.3 },
  { def: 'door', id: 'door-2', x: 2, z: 4, lock: 'small-key' },
  { def: 'block', id: 'block-1', x: -2, z: 0 },
  { def: 'one-way', id: 'gate-1', x: 0, z: 6, from: 'kiln' },
  { def: 'chest', id: 'chest-1', x: 3, z: 10, contents: 'small-key', hidden: 'plate-1' },
  { def: 'chest', id: 'chest-2', x: -3, z: 10, contents: 'embers:20' },
  { def: 'pot', id: 'pot-1', x: 3, z: -3, drop: 'pot' },
  { def: 'cracked', id: 'crack-1', x: -3, z: 6 },
  { def: 'hook-post', id: 'post-1', x: 0, z: 9 },
  { def: 'sling-target', id: 'eye-1', x: 3, z: 3, height: 2.6, targets: ['door-1'] },
  { def: 'ledge-drop', id: 'ledge-1', x: 2, z: 8, to: 'hall' },
  { def: 'npc', id: 'lamplighter', x: -2, z: -2, figure: 'target', lines: 'npc.lamplighter' },
  { def: 'shop', id: 'shop-1', x: 2, z: -3, stock: 'kiln' },
  { def: 'entry', id: 'entry-1', x: 0, z: -2, facing: 0, portal: 'door-2' },
]

/** The error `compileArea` throws for `entities`, or undefined when it loads. */
function loadError(entities: AreaSource['entities']): AreaLoadError | undefined {
  try {
    compileArea(withEntities(entities))
    return undefined
  } catch (error) {
    if (error instanceof AreaLoadError) return error
    throw error
  }
}

describe('area entities (GAME-3D.1f part 1, G3-F2)', () => {
  it('loads one of every definition, in fixed point, in the order written', () => {
    const area = compileArea(withEntities(EVERY_DEF))
    expect(area.entities.map((entity) => [entity.def, entity.id])).toEqual(
      EVERY_DEF.map((entity) => [entity.def, entity.id]),
    )
    expect(area.entities[1]).toMatchObject({ x: 0, z: metres(4), width: metres(2), depth: metres(0.3) })
    // A box with no size is a 1 m cell.
    expect(area.entities[3]).toMatchObject({ width: metres(1), depth: metres(1) })
  })

  it('leaves out a field given as undefined, so the content stays canonical JSON', () => {
    const area = compileArea(
      withEntities([{ def: 'door', id: 'd', x: 0, z: 4, lock: 'none', switch: undefined }]),
    )
    expect(Object.hasOwn(area.entities[0] ?? {}, 'switch')).toBe(false)
  })

  it('takes an area with no entities', () => {
    expect(compileArea(FIRST_SLICE).entities).toEqual([])
  })

  it('names the area and the JSON path of an unknown definition', () => {
    const error = loadError([{ def: 'trapdoor', id: 'x', x: 0, z: 0 }])
    expect(error?.area).toBe('first-slice')
    expect(error?.path).toBe('entities[0].def')
    expect(error?.message).toContain('base-3d area "first-slice": entities[0].def')
    expect(error?.message).toContain('trapdoor')
  })

  it('names the path of an unknown lock, kind or contents', () => {
    expect(loadError([{ def: 'door', id: 'd', x: 0, z: 4, lock: 'gold' }])?.path).toBe('entities[0].lock')
    expect(loadError([{ def: 'switch', id: 's', x: 0, z: 0, kind: 'button' }])?.path).toBe('entities[0].kind')
    expect(
      loadError([EVERY_DEF[3] as never, { def: 'chest', id: 'c', x: 0, z: 0, contents: 'sword' }])?.path,
    ).toBe('entities[1].contents')
    expect(loadError([{ def: 'chest', id: 'c', x: 0, z: 0, contents: 'embers:0' }])?.path).toBe(
      'entities[0].contents',
    )
    expect(loadError([{ def: 'sling-target', id: 't', x: 0, z: 0, height: 4 }])?.path).toBe(
      'entities[0].height',
    )
  })

  it('names the path of a dangling reference', () => {
    expect(loadError([{ def: 'door', id: 'd', x: 0, z: 4, lock: 'switch', switch: 'nowhere' }])?.path).toBe(
      'entities[0].switch',
    )
    expect(
      loadError([
        { def: 'block', id: 'b', x: 0, z: 0 },
        { def: 'door', id: 'd', x: 0, z: 4, lock: 'switch', switch: 'b' },
      ])?.path,
    ).toBe('entities[1].switch')
    expect(loadError([{ def: 'door', id: 'd', x: 0, z: 4, lock: 'switch' }])?.path).toBe('entities[0].switch')
    expect(
      loadError([{ def: 'switch', id: 's', x: 0, z: 0, kind: 'lever', targets: ['a', 'gone'] }])?.path,
    ).toBe('entities[0].targets[0]')
    expect(loadError([{ def: 'chest', id: 'c', x: 0, z: 0, contents: 'map', hidden: 'gone' }])?.path).toBe(
      'entities[0].hidden',
    )
    expect(loadError([{ def: 'one-way', id: 'o', x: 0, z: 0, from: 'cellar' }])?.path).toBe(
      'entities[0].from',
    )
    expect(loadError([{ def: 'ledge-drop', id: 'l', x: 0, z: 0, to: 'cellar' }])?.path).toBe('entities[0].to')
    expect(loadError([{ def: 'entry', id: 'e', x: 0, z: 0, portal: 'gone' }])?.path).toBe(
      'entities[0].portal',
    )
  })

  it('names the path of an id used twice', () => {
    expect(
      loadError([
        { def: 'pot', id: 'same', x: 0, z: 0, drop: 'pot' },
        { def: 'cracked', id: 'same', x: 1, z: 0 },
      ])?.path,
    ).toBe('entities[1].id')
  })

  it('makes the hook posts from hook-post entities', () => {
    const area = compileArea(withEntities([{ def: 'hook-post', id: 'p', x: 1, z: 9 }]))
    expect(area.posts).toEqual([{ x: metres(1), z: metres(9) }])
  })
})
