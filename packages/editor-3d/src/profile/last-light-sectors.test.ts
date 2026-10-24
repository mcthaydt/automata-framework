// The rooms of a Last Light blockout as the editor's edits see them (ED3D.3 step 3). The references are the sentences
// of Last Light's own `roomReferences` (editor/src/server/level-edits.ts, 92e6704) and its tests' cases.
import { describe, expect, it } from 'vitest'
import type { Blockout, Room } from '../format/blockout.schema'
import { FIXTURE_NAMES, loadFixture } from '../testing/fixtures'
import { literalEdits } from '../testing/text-diff'
import { must } from '../testing/toy-blockout'
import { blockoutCodec } from './last-light-codecs'
import { lastLightSectorAccess } from './last-light-sectors'
import { type EditSector, SectorAccessError } from './sector-access'

const BLOCKOUTS = FIXTURE_NAMES.filter((name) => name !== 'facility')

function read(name: (typeof FIXTURE_NAMES)[number]): { text: string; level: Blockout } {
  const text = loadFixture(name)
  const result = blockoutCodec.parse(text)
  if (!result.ok) throw new Error(`${name} does not parse`)
  return { text, level: result.value }
}

const dawn = read('blockout-clinic-dawn')
const room = (id: string): Room => must(dawn.level.rooms.find((each) => each.id === id))

describe('the Last Light access: list and withSectors', () => {
  it.each(BLOCKOUTS)(
    "%s: lists the rooms as the level's own objects and hands the level back unchanged",
    (name) => {
      const { level } = read(name)
      const listed = lastLightSectorAccess.list(level)
      expect(listed).toHaveLength(level.rooms.length)
      listed.forEach((sector, i) => {
        expect(sector).toBe(level.rooms[i])
      })
      expect(lastLightSectorAccess.withSectors(level, listed)).toBe(level)
    },
  )

  it('keeps everything but the rooms as it was, and a room that did not change as the same object', () => {
    const { level } = dawn
    const dimmer: EditSector = { ...room('hall'), light: 0.8 }
    const after = lastLightSectorAccess.withSectors(
      level,
      lastLightSectorAccess.list(level).map((each) => (each.id === 'hall' ? dimmer : each)),
    )
    expect(must(after.rooms[0]).light).toBe(0.8)
    expect(must(after.rooms[0]).zone).toBe('hall')
    expect(after.rooms[1]).toBe(level.rooms[1])
    expect(after.spawn).toBe(level.spawn)
    expect(after.openings).toBe(level.openings)
    expect(after.zones).toBe(level.zones)
    expect(after.nav).toBe(level.nav)
  })

  it('writes back through the codec as the bytes of the one member that changed', () => {
    const dimmer: EditSector = { ...room('hall'), light: 0.8 }
    const after = lastLightSectorAccess.withSectors(
      dawn.level,
      lastLightSectorAccess.list(dawn.level).map((each) => (each.id === 'hall' ? dimmer : each)),
    )
    const result = blockoutCodec.patch(dawn.text, dawn.level, after)
    if (!result.ok) throw new Error(`patch refused: ${result.detail}`)
    expect(literalEdits(dawn.text, result.text)).toEqual(['["rooms",0,"light"]'])
  })

  it('keeps a wall written as a name and one that starts from a preset', () => {
    const ward = room('ward')
    const moved: EditSector = { ...ward, floor: 0.1 }
    const after = lastLightSectorAccess.withSectors(
      dawn.level,
      lastLightSectorAccess.list(dawn.level).map((each) => (each.id === 'ward' ? moved : each)),
    )
    expect(must(after.rooms.find((each) => each.id === 'ward')).corners).toBe(ward.corners)
  })

  it('drops the last room and a room from the middle, and hands the level back only when nothing changed', () => {
    const rooms = lastLightSectorAccess.list(dawn.level)
    expect(lastLightSectorAccess.withSectors(dawn.level, rooms.slice(0, -1)).rooms).toEqual(
      dawn.level.rooms.slice(0, -1),
    )
    expect(
      lastLightSectorAccess.withSectors(
        dawn.level,
        rooms.filter((each) => each.id !== 'ward'),
      ).rooms,
    ).toEqual(dawn.level.rooms.filter((each) => each.id !== 'ward'))
    expect(lastLightSectorAccess.withSectors(dawn.level, [...rooms])).toBe(dawn.level)
  })

  it('refuses a sector that has no zone, since a Last Light room must have one', () => {
    const bare: EditSector = {
      id: 'store',
      floor: 0,
      ceiling: 3,
      light: 1,
      corners: [
        [0, 0],
        [1, 0],
        [1, 1],
      ],
    }
    const sectors = [...lastLightSectorAccess.list(dawn.level), bare]
    expect(() => lastLightSectorAccess.withSectors(dawn.level, sectors)).toThrow(SectorAccessError)
    expect(() => lastLightSectorAccess.withSectors(dawn.level, sectors)).toThrow(
      'sector store has no zone, and a Last Light room must have one',
    )
  })
})

describe('the Last Light access refuses the members only af-sector/1 has', () => {
  it('refuses a room with a view id, since the game reads none', () => {
    const sectors = lastLightSectorAccess
      .list(dawn.level)
      .map((sector) => (sector.id === 'hall' ? { ...sector, view: 'hall-view' } : sector))
    expect(() => lastLightSectorAccess.withSectors(dawn.level, sectors)).toThrow(SectorAccessError)
    expect(() => lastLightSectorAccess.withSectors(dawn.level, sectors)).toThrow(
      'sector hall has a view id, which a Last Light room cannot hold',
    )
  })

  it('refuses a wall with an occlude, and says which sector and corner', () => {
    const sectors = lastLightSectorAccess.list(dawn.level).map((sector) =>
      sector.id === 'hall'
        ? {
            ...sector,
            corners: sector.corners.map((corner, i) =>
              i === 1 ? [corner[0], corner[1], { occlude: 'fade' }] : corner,
            ),
          }
        : sector,
    ) as EditSector[]
    expect(() => lastLightSectorAccess.withSectors(dawn.level, sectors)).toThrow(SectorAccessError)
    expect(() => lastLightSectorAccess.withSectors(dawn.level, sectors)).toThrow(
      'wall 1 of sector hall has an occlude, which a Last Light wall cannot hold',
    )
  })

  it('still takes the room with neither', () => {
    expect(lastLightSectorAccess.withSectors(dawn.level, lastLightSectorAccess.list(dawn.level))).toBe(
      dawn.level,
    )
  })
})

describe('the Last Light access: takenIds and create', () => {
  it('takes the ids of the rooms and of the openings', () => {
    expect(lastLightSectorAccess.takenIds(dawn.level)).toEqual([
      'hall',
      'counter',
      'ward',
      'mouth',
      'corridor',
      'doorway',
      'closet',
      'yard',
      'exitWay',
    ])
  })

  it('makes a room in the zone of the room it is drawn like, with its materials', () => {
    const like = { ...room('closet'), style: 'COLD', floorTexture: 'tile' } satisfies EditSector
    const made = lastLightSectorAccess.create(dawn.level, {
      id: 'store',
      corners: [
        [-4.6, -9.6],
        [-1.6, -9.6],
        [-1.6, -7.4],
        [-4.6, -7.4],
      ],
      floor: 0,
      ceiling: 3.2,
      light: 1,
      like,
    })
    expect(made).toStrictEqual({
      id: 'store',
      zone: 'closet',
      floor: 0,
      ceiling: 3.2,
      light: 1,
      style: 'COLD',
      floorTexture: 'tile',
      corners: [
        [-4.6, -9.6],
        [-1.6, -9.6],
        [-1.6, -7.4],
        [-4.6, -7.4],
      ],
    })
  })

  it("puts a room drawn like nothing in the first room's zone, and in the first camera zone for an empty level", () => {
    const draft = {
      id: 'store',
      corners: [
        [0, 0],
        [1, 0],
        [1, 1],
      ] as const,
      floor: 0,
      ceiling: 3,
      light: 1,
    }
    expect(lastLightSectorAccess.create(dawn.level, draft)).toHaveProperty('zone', 'hall')
    const reversed = { ...dawn.level, zones: [...dawn.level.zones].reverse() }
    expect(must(reversed.zones[0]).id).not.toBe('hall')
    expect(lastLightSectorAccess.create(reversed, draft)).toHaveProperty('zone', 'hall')
    const empty = { ...dawn.level, rooms: [] }
    expect(lastLightSectorAccess.create(empty, draft)).toHaveProperty('zone', must(dawn.level.zones[0]).id)
    expect(lastLightSectorAccess.create({ ...empty, zones: [] }, draft)).toHaveProperty('zone', '')
  })

  it('makes a room that the level accepts back through withSectors', () => {
    const made = lastLightSectorAccess.create(dawn.level, {
      id: 'store',
      corners: [
        [0, 0],
        [1, 0],
        [1, 1],
      ],
      floor: 0,
      ceiling: 3,
      light: 1,
    })
    const after = lastLightSectorAccess.withSectors(dawn.level, [
      ...lastLightSectorAccess.list(dawn.level),
      made,
    ])
    expect(after.rooms.at(-1)).toStrictEqual(made)
  })
})

describe('the Last Light access: references', () => {
  const refs = (level: Blockout, id: string) => lastLightSectorAccess.references(level, id)

  it('names the portals into a room and the things that stand in it', () => {
    const ward = refs(dawn.level, 'ward')
    expect(ward).toEqual(
      expect.arrayContaining(['room hall corner 12: a portal into ward', 'box filing stands in it']),
    )
  })

  it("names the openings that join a room, in the order of Last Light's sentence", () => {
    expect(refs(dawn.level, 'yard')).toEqual(expect.arrayContaining(['opening exitWay (corridor → yard)']))
    expect(refs(dawn.level, 'corridor')).toEqual(
      expect.arrayContaining(['opening exitWay (corridor → yard)']),
    )
  })

  it('names a wall preset whose `next` is the room', () => {
    expect(refs(dawn.level, 'counter')).toEqual(expect.arrayContaining(['wall preset COUNTER: next counter']))
  })

  it('names the things that stand in a room: box, hotspot, lamp, anchor, nav node, bounce point and the spawn', () => {
    const level: Blockout = {
      ...dawn.level,
      rooms: [
        ...dawn.level.rooms,
        {
          id: 'store',
          zone: 'hall',
          floor: 0,
          ceiling: 3,
          light: 1,
          corners: [
            [20, 20],
            [30, 20],
            [30, 30],
            [20, 30],
          ],
        },
      ],
      spawn: { x: 21, y: 0, z: 21, facing: 0 },
      boxes: [
        ...dawn.level.boxes,
        { id: 'crate', kind: 'furniture', role: 'collider', x: 22, z: 22, y: 0.5, w: 1, h: 1, d: 1 },
      ],
      hotspots: [...dawn.level.hotspots, { id: 'panel', x: 23, y: 1, z: 23, name: 'Panel', reach: 1 }],
      lamps: [
        ...dawn.level.lamps,
        { id: 'lamp9', x: 24, y: 2, z: 24, range: 4, radius: 0.1, color: [1, 1, 1] },
      ],
      anchors: { ...dawn.level.anchors, valve: { x: 25, z: 25 } },
      nav: { ...dawn.level.nav, nodes: { ...dawn.level.nav.nodes, store1: { x: 26, z: 26 } } },
      bounce: [...(dawn.level.bounce ?? []), [27, 1, 27]],
    }
    expect(refs(level, 'store')).toEqual([
      'box crate stands in it',
      'hotspot panel is in it',
      'lamp lamp9 is in it',
      'anchor valve is in it',
      'nav node store1 is in it',
      'bounce point 27, 1, 27 is in it',
      'the spawn is in it',
    ])
  })

  it('names the things that point at one of its walls with `on: wall:<room>/<corner>`', () => {
    const hotspot = must(dawn.level.hotspots[0])
    const level: Blockout = {
      ...dawn.level,
      hotspots: [{ ...hotspot, on: 'wall:ward/3' }, ...dawn.level.hotspots.slice(1)],
    }
    expect(refs(level, 'ward')).toContain('hotspots.0.on: wall:ward/3')
  })

  it("finds an `on` reference of each kind of thing, and only those that name this room's corner exactly", () => {
    const hotspot = must(dawn.level.hotspots[0])
    const lamp = must(dawn.level.lamps[0])
    const level: Blockout = {
      ...dawn.level,
      hotspots: [{ ...hotspot, on: 'wall:hall/3' }, ...dawn.level.hotspots.slice(1)],
      lamps: [{ ...lamp, on: 'wall:ward/1' }, ...dawn.level.lamps.slice(1)],
      anchors: { ...dawn.level.anchors, fuseBox: { x: -1.45, z: -4.1, on: 'wall:ward/2' } },
      nav: {
        ...dawn.level.nav,
        nodes: { ...dawn.level.nav.nodes, end: { x: -6, z: -9, on: 'wall:ward/0' } },
      },
    }
    expect(refs(level, 'ward')).toEqual(
      expect.arrayContaining([
        'lamps.0.on: wall:ward/1',
        'anchors.fuseBox.on: wall:ward/2',
        'nav.nodes.end.on: wall:ward/0',
      ]),
    )
    expect(refs(level, 'ward').filter((sentence) => sentence.includes(': wall:'))).toHaveLength(3)
    const longer: Blockout = {
      ...dawn.level,
      hotspots: [{ ...hotspot, on: 'wall:ward/3x' }, ...dawn.level.hotspots.slice(1)],
    }
    expect(refs(longer, 'ward').filter((sentence) => sentence.includes(': wall:'))).toEqual([])
  })

  it('does not stop at a wall preset that does not exist: it leads nowhere, and the checks say so', () => {
    const ward = room('ward')
    const odd: Room = {
      ...ward,
      corners: ward.corners.map((corner, i) =>
        i === 0 ? ([corner[0], corner[1], { preset: 'NOPE' }] as const) : corner,
      ),
    }
    const level = {
      ...dawn.level,
      rooms: dawn.level.rooms.map((each) => (each.id === 'ward' ? odd : each)),
    }
    expect(() => refs(level, 'hall')).not.toThrow()
    expect(refs(level, 'hall')).not.toContain('room ward corner 0: a portal into hall')
  })

  it('leaves out a thing that stands in a hole of the room', () => {
    const ring: Room = {
      id: 'ring',
      zone: 'hall',
      floor: 0,
      ceiling: 3,
      light: 1,
      corners: [
        [20, 20],
        [30, 20],
        [30, 30],
        [20, 30],
      ],
      holes: [
        [
          [23, 23],
          [27, 23],
          [27, 27],
          [23, 27],
        ],
      ],
    }
    const level: Blockout = {
      ...dawn.level,
      rooms: [...dawn.level.rooms, ring],
      boxes: [
        ...dawn.level.boxes,
        { id: 'inHole', kind: 'furniture', role: 'collider', x: 25, z: 25, y: 0.5, w: 1, h: 1, d: 1 },
        { id: 'inRing', kind: 'furniture', role: 'collider', x: 21, z: 21, y: 0.5, w: 1, h: 1, d: 1 },
      ],
    }
    expect(refs(level, 'ring')).toEqual(['box inRing stands in it'])
  })

  it('has nothing for a room nobody names and nothing stands in, and for one that is not there', () => {
    const store: Room = {
      id: 'store',
      zone: 'corridor',
      floor: 0,
      ceiling: 3.2,
      light: 1,
      corners: [
        [-4.6, -9.6],
        [-1.6, -9.6],
        [-1.6, -7.4],
        [-4.6, -7.4],
      ],
    }
    const level = { ...dawn.level, rooms: [...dawn.level.rooms, store] }
    expect(refs(level, 'store')).toEqual([])
    expect(refs(level, 'nowhere')).toEqual([])
  })
})

describe('the Last Light access: pinned', () => {
  const pinned = (level: Blockout, id: string) => lastLightSectorAccess.pinned(level, id)

  it('names the openings that join a room, for both of its rooms', () => {
    expect(pinned(dawn.level, 'yard')).toEqual(['opening exitWay (corridor → yard)'])
    expect(pinned(dawn.level, 'corridor')).toEqual(['opening exitWay (corridor → yard)'])
  })

  it('names a wall preset whose `next` is the room', () => {
    expect(pinned(dawn.level, 'counter')).toEqual(['wall preset COUNTER: next counter'])
  })

  it('names the things that point at one of its walls with `on: wall:<room>/<corner>`', () => {
    const hotspot = must(dawn.level.hotspots[0])
    const level: Blockout = {
      ...dawn.level,
      hotspots: [{ ...hotspot, on: 'wall:ward/3' }, ...dawn.level.hotspots.slice(1)],
    }
    expect(pinned(level, 'ward')).toEqual(['hotspots.0.on: wall:ward/3'])
  })

  it('names nothing for a room that only has portals into it and things standing in it', () => {
    // `ward` is led into by the hall and has a box in it (both are in `references`), and nothing is tied to its walls.
    expect(lastLightSectorAccess.references(dawn.level, 'ward').length).toBeGreaterThan(0)
    expect(pinned(dawn.level, 'ward')).toEqual([])
  })

  it('names nothing for a room that is not there, even when a wall preset leads into it', () => {
    expect(pinned(dawn.level, 'nowhere')).toEqual([])
    const level: Blockout = { ...dawn.level, walls: { ...dawn.level.walls, GHOST: { next: 'ghost' } } }
    expect(pinned(level, 'ghost')).toEqual([])
  })

  it('is a part of what `references` says, in its order', () => {
    const all = lastLightSectorAccess.references(dawn.level, 'counter')
    expect(all).toEqual(expect.arrayContaining([...pinned(dawn.level, 'counter')]))
  })
})

describe('the Last Light access: portalOf', () => {
  it("says where a wall leads: its `next`, its preset's `next`, and nowhere for a name or a plain wall", () => {
    const { level } = dawn
    expect(lastLightSectorAccess.portalOf(level, must(room('hall').corners[0])[2])).toBe('mouth')
    expect(lastLightSectorAccess.portalOf(level, must(room('hall').corners[4])[2])).toBeUndefined()
    expect(lastLightSectorAccess.portalOf(level, must(room('hall').corners[1])[2])).toBeUndefined()
    expect(lastLightSectorAccess.portalOf(level, { preset: 'COUNTER' })).toBe('counter')
    expect(lastLightSectorAccess.portalOf(level, { preset: 'COUNTER', next: 'ward' })).toBe('ward')
    expect(lastLightSectorAccess.portalOf(level, undefined)).toBeUndefined()
  })

  it('leads nowhere through a preset that is not there (the checks say so)', () => {
    expect(lastLightSectorAccess.portalOf(dawn.level, { preset: 'NOPE' })).toBeUndefined()
  })
})
