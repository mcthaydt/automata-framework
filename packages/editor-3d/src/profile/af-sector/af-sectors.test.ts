// The sectors of an `af-sector/1` level as the editor's edits see them (ED3D.3 step 3).

import type { AfSector, AfSectorEntry } from '@automata/3d/level'
import { describe, expect, it } from 'vitest'
import { must } from '../../testing/edit-helpers'
import { loadAuthored } from '../../testing/fixtures'
import { literalEdits } from '../../testing/text-diff'
import { toyAfSector } from '../../testing/toy-af-sector'
import { type EditSector, SectorAccessError } from '../sector-access'
import { afSectorCodec } from './af-codec'
import { afSectorAccess } from './af-sectors'

const depotText = loadAuthored('depot.af-sector')
const depot = (() => {
  const result = afSectorCodec.parse(depotText)
  if (!result.ok) throw new Error('the depot does not parse')
  return result.value
})()
const hall = must(depot.sectors[0])
const dock = must(depot.sectors[1])

describe('the af-sector access: list and withSectors', () => {
  it("lists the sectors in file order, as the level's own objects", () => {
    const listed = afSectorAccess.list(depot)
    expect(listed).toHaveLength(2)
    expect(listed[0]).toBe(hall)
    expect(listed[1]).toBe(dock)
  })

  it('hands the level itself back when the sectors are its own, unchanged', () => {
    expect(afSectorAccess.withSectors(depot, afSectorAccess.list(depot))).toBe(depot)
  })

  it('keeps every other member of the level, and the sectors that did not change as the same objects', () => {
    const level: AfSector = { ...depot, editorState: { zoom: 2 } } as AfSector
    const dimmer: EditSector = { ...hall, light: 0.8 }
    const after = afSectorAccess.withSectors(level, [dimmer, dock])
    expect(after).toEqual({ ...level, sectors: [{ ...hall, light: 0.8 }, dock] })
    expect(after.sectors[1]).toBe(dock)
    expect(after.entities).toBe(level.entities)
    expect(after).toHaveProperty('editorState', { zoom: 2 })
  })

  it('drops, adds and reorders sectors as it is told', () => {
    const yard: EditSector = {
      id: 'yard',
      floor: 0,
      ceiling: 3,
      light: 1,
      corners: [
        [20, 0],
        [24, 0],
        [24, 4],
      ],
    }
    expect(afSectorAccess.withSectors(depot, [dock]).sectors).toEqual([dock])
    expect(afSectorAccess.withSectors(depot, [hall]).sectors).toEqual([hall])
    expect(afSectorAccess.withSectors(depot, [dock, hall, yard]).sectors.map((s) => s.id)).toEqual([
      'dock',
      'hall',
      'yard',
    ])
  })

  it('writes back through the codec as the bytes of the one member that changed', () => {
    const dimmer: EditSector = { ...hall, light: 0.8 }
    const after = afSectorAccess.withSectors(depot, [dimmer, dock])
    const result = afSectorCodec.patch(depotText, depot, after)
    if (!result.ok) throw new Error(`patch refused: ${result.detail}`)
    expect(literalEdits(depotText, result.text)).toEqual(['["sectors",0,"light"]'])
  })

  it('keeps the shape of a corner: no wall is [x, z], a wall object stays the same object', () => {
    const moved: EditSector = {
      ...hall,
      corners: hall.corners.map((corner, i) => (i === 2 ? ([8.5, 6] as const) : corner)),
    }
    const after = afSectorAccess.withSectors(depot, [moved, dock])
    const corners = must(after.sectors[0]).corners
    expect(corners[2]).toEqual([8.5, 6])
    expect(corners[2]).toHaveLength(2)
    expect(corners[0]?.[2]).toBe(must(hall.corners[0])[2])
  })

  it('keeps the holes of a sector, and refuses a wall written as a name, in the outline or in a hole', () => {
    const square = [
      [0, 0],
      [4, 0],
      [4, 4],
      [0, 4],
    ] as const
    const holed: EditSector = {
      ...hall,
      holes: [
        [
          [1, 1],
          [2, 1],
          [2, 2],
        ],
      ],
    }
    expect(must(afSectorAccess.withSectors(depot, [holed, dock]).sectors[0]).holes).toEqual([
      [
        [1, 1],
        [2, 1],
        [2, 2],
      ],
    ])
    const named: EditSector = { ...hall, corners: [[0, 0, 'west'], ...square.slice(1)] }
    expect(() => afSectorAccess.withSectors(depot, [named, dock])).toThrow(SectorAccessError)
    expect(() => afSectorAccess.withSectors(depot, [named, dock])).toThrow(
      'a wall written as a name ("west") cannot be held by an af-sector level',
    )
    const namedHole: EditSector = {
      ...hall,
      holes: [
        [
          [1, 1],
          [2, 1, 'east'],
          [2, 2],
        ],
      ],
    }
    expect(() => afSectorAccess.withSectors(depot, [namedHole, dock])).toThrow(SectorAccessError)
  })
})

describe('the af-sector access: takenIds and create', () => {
  it('takes every sector id', () => {
    expect(afSectorAccess.takenIds(depot)).toEqual(['hall', 'dock'])
  })

  it('makes a sector with the members the format requires and the corners as pairs', () => {
    const yard = afSectorAccess.create(depot, {
      id: 'yard',
      corners: [
        [14, 0],
        [18, 0],
        [18, 6],
        [14, 6],
      ],
      floor: -1,
      ceiling: 4,
      light: 0.5,
    })
    expect(yard).toStrictEqual({
      id: 'yard',
      floor: -1,
      ceiling: 4,
      light: 0.5,
      corners: [
        [14, 0],
        [18, 0],
        [18, 6],
        [14, 6],
      ],
    })
  })

  it('shares the materials of the sector it is drawn like, and nothing else of it', () => {
    const like: EditSector = {
      ...hall,
      style: 'plain',
      ceilingTexture: 'plaster',
      open: true,
      trim: { skirting: 0.2, wainscot: 0, rail: 0, cap: false },
    }
    const yard = afSectorAccess.create(depot, {
      id: 'yard',
      corners: [
        [14, 0],
        [18, 0],
        [18, 6],
      ],
      floor: 0,
      ceiling: 4,
      light: 1,
      like,
    })
    expect(yard).toStrictEqual({
      id: 'yard',
      floor: 0,
      ceiling: 4,
      light: 1,
      style: 'plain',
      floorTexture: 'tile',
      ceilingTexture: 'plaster',
      wallTexture: 'brick',
      corners: [
        [14, 0],
        [18, 0],
        [18, 6],
      ],
    })
  })

  it('does not share the corners of the draft array: a later change to it leaves the sector alone', () => {
    const draft: [number, number][] = [
      [0, 0],
      [1, 0],
      [1, 1],
    ]
    const made = afSectorAccess.create(depot, { id: 'x', corners: draft, floor: 0, ceiling: 3, light: 1 })
    must(draft[0])[0] = 9
    expect(must(made.corners[0])[0]).toBe(0)
  })
})

describe('the af-sector access: references', () => {
  it('names the portals into a sector and the entities that stand in it, in that order', () => {
    expect(afSectorAccess.references(depot, 'hall')).toEqual([
      'sector dock corner 3: a portal into hall',
      'entity spawn stands in it',
    ])
    expect(afSectorAccess.references(depot, 'dock')).toEqual([
      'sector hall corner 1: a portal into dock',
      'entity crate1 stands in it',
    ])
  })

  it('has nothing for a sector nobody names and nothing stands in, and for one that is not there', () => {
    const yard: AfSectorEntry = {
      id: 'yard',
      floor: 0,
      ceiling: 3,
      light: 1,
      corners: [
        [20, 0],
        [24, 0],
        [24, 4],
      ],
    }
    const level = { ...depot, sectors: [...depot.sectors, yard] }
    expect(afSectorAccess.references(level, 'yard')).toEqual([])
    expect(afSectorAccess.references(level, 'nowhere')).toEqual([])
  })

  it("does not count a sector's own portals, and finds one in a hole", () => {
    const a: AfSectorEntry = {
      id: 'a',
      floor: 0,
      ceiling: 3,
      light: 1,
      corners: [
        [0, 0],
        [9, 0],
        [9, 9],
        [0, 9],
      ],
      holes: [
        [
          [2, 2],
          [3, 2, { next: 'b' }],
          [3, 3],
          [2, 3],
        ],
      ],
    }
    const b: AfSectorEntry = {
      id: 'b',
      floor: 0,
      ceiling: 3,
      light: 1,
      corners: [
        [2, 2],
        [3, 2],
        [3, 3, { next: 'b' }],
        [2, 3],
      ],
    }
    const level = toyAfSector({ sectors: [a, b] })
    expect(afSectorAccess.references(level, 'b')).toEqual(['sector a hole 0 corner 1: a portal into b'])
  })

  it('leaves out an entity inside a hole of the sector', () => {
    const ring: AfSectorEntry = {
      id: 'ring',
      floor: 0,
      ceiling: 3,
      light: 1,
      corners: [
        [0, 0],
        [9, 0],
        [9, 9],
        [0, 9],
      ],
      holes: [
        [
          [3, 3],
          [6, 3],
          [6, 6],
          [3, 6],
        ],
      ],
    }
    const level = toyAfSector({
      sectors: [ring],
      entities: [
        { def: 'crate', id: 'inside', x: 1, z: 1 },
        { def: 'crate', id: 'inHole', x: 4, z: 4 },
        { def: 'crate', id: 'outside', x: 12, z: 1 },
      ],
    })
    expect(afSectorAccess.references(level, 'ring')).toEqual(['entity inside stands in it'])
  })
})

describe('the af-sector access: portalOf', () => {
  it('says where a wall leads: the sector in its `next`, and nowhere for any other wall', () => {
    expect(afSectorAccess.portalOf(depot, must(hall.corners[1])[2])).toBe('dock')
    expect(afSectorAccess.portalOf(depot, must(hall.corners[0])[2])).toBeUndefined()
    expect(afSectorAccess.portalOf(depot, must(hall.corners[2])[2])).toBeUndefined()
    expect(afSectorAccess.portalOf(depot, {})).toBeUndefined()
    expect(afSectorAccess.portalOf(depot, 'a-name')).toBeUndefined()
  })
})

describe('the af-sector access: pinned', () => {
  it('has nothing for any sector: no wall of an af-sector level is named from outside the sector', () => {
    expect(afSectorAccess.pinned(depot, 'hall')).toEqual([])
    expect(afSectorAccess.pinned(depot, 'dock')).toEqual([])
    expect(afSectorAccess.pinned(depot, 'nowhere')).toEqual([])
  })
})
