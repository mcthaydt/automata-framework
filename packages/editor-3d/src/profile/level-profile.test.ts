// The two profiles (ED3D.1b step 5): each is its codec plus the geometry the views draw and the checks the problems
// list shows, behind one shape the editor core imports without naming a Last Light concept.
import { describe, expect, it } from 'vitest'
import { entitySelection } from '../checks/check'
import { lastLightChecks } from '../checks/last-light/last-light-checks'
import type { AfSector } from '../format/af-sector.schema'
import type { Blockout } from '../format/blockout.schema'
import { resolveMap } from '../geometry/sectors'
import { parseSelection } from '../model/selection-ref'
import { loadAuthored, loadFixture } from '../testing/fixtures'
import {
  BLOCKOUT_NAMES,
  expandedBlockout,
  loadGeometryGolden,
  navShape,
  piecesShape,
  sectorsShape,
} from '../testing/geometry-golden'
import { toyAfSector, toyHall } from '../testing/toy-af-sector'
import { must, toyBlockout, toyOpening } from '../testing/toy-blockout'
import { afSectorChecks } from './af-sector/af-checks'
import { afEntityKit } from './af-sector/af-entities'
import { afSectorAccess } from './af-sector/af-sectors'
import { buildSectors } from './af-sector/build'
import { afSectorProfile } from './af-sector-profile'
import { lastLightEntityKit } from './last-light-entities'
import { lastLightProfile } from './last-light-profile'
import { lastLightSectorAccess } from './last-light-sectors'
import { GeometryError } from './level-profile'

/** The error a call throws, which a test knows is a `GeometryError` and checks to the word. */
function geometryError(call: () => unknown): GeometryError {
  try {
    call()
  } catch (error) {
    if (error instanceof GeometryError) return error
    throw error
  }
  throw new Error('the call did not throw')
}

const depot = (): AfSector => {
  const result = afSectorProfile.parse(loadAuthored('depot.af-sector'))
  if (!result.ok) throw new Error('the depot does not parse')
  return result.value
}

describe('GeometryError', () => {
  it('is an error that says what the engine said', () => {
    const error = new GeometryError('a: unknown portal target b')
    expect(error).toBeInstanceOf(Error)
    expect(error.name).toBe('GeometryError')
    expect(error.message).toBe('a: unknown portal target b')
  })
})

describe('the Last Light blockout profile', () => {
  it('is the blockout codec: its id, its parse and its patch', () => {
    expect(lastLightProfile.id).toBe('last-light-blockout')
    const text = loadFixture('blockout-clinic')
    const parsed = lastLightProfile.parse(text)
    if (!parsed.ok) throw new Error('does not parse')
    expect(parsed.value).toStrictEqual(JSON.parse(text))
    expect(lastLightProfile.patch(text, parsed.value, structuredClone(parsed.value))).toStrictEqual({
      ok: true,
      text,
    })
  })

  for (const name of BLOCKOUT_NAMES) {
    describe(name, () => {
      const blockout = JSON.parse(loadFixture(name)) as Blockout
      const golden = loadGeometryGolden()[name]
      const { layers } = lastLightProfile.geometry(blockout)

      it('has one layer of sectors', () => {
        expect(layers.map((layer) => layer.kind)).toEqual(['sectors'])
      })

      it('holds the map Last Light’s own code made of it', () => {
        const map = must(layers[0]).map
        expect(sectorsShape(map)).toEqual(golden.map.sectors)
        expect(JSON.parse(JSON.stringify(map.masses))).toEqual(golden.map.masses)
        expect(piecesShape(map)).toEqual({
          pieces: golden.map.pieces,
          colliders: golden.map.colliders,
          sightWalls: golden.map.sightWalls,
        })
      })

      it('holds a nav world that answers as Last Light’s did', () => {
        const nav = must(layers[0]?.nav)
        expect(navShape(nav, expandedBlockout(name))).toEqual(golden.nav)
      })
    })
  }

  it('throws the expander’s sentence for a blockout that does not expand', () => {
    const level = toyBlockout({ openings: [{ ...toyOpening, id: 'ab', to: 'nowhere' }] })
    expect(geometryError(() => lastLightProfile.geometry(level)).message).toBe(
      'opening ab: unknown room nowhere',
    )
  })

  it('throws the engine’s sentence for a portal to a room that is not there', () => {
    const level = toyBlockout()
    const [a, b] = level.rooms
    const broken = {
      ...level,
      openings: [],
      boxes: [],
      rooms: [
        {
          ...must(a),
          corners: [
            [0, 0],
            [4, 0, { next: 'nowhere' }],
            [4, 4],
            [0, 4],
          ],
        },
        must(b),
      ],
    } as Blockout
    expect(geometryError(() => lastLightProfile.geometry(broken)).message).toBe(
      'a: unknown portal target nowhere',
    )
  })

  it('checks as lastLightChecks does, with the puzzle hotspots of the context', () => {
    const blockout = toyBlockout()
    expect(lastLightProfile.checks(blockout, { puzzleHotspots: ['far'] })).toEqual(
      lastLightChecks(blockout, { puzzleHotspots: ['far'] }),
    )
    expect(lastLightProfile.checks(blockout, { puzzleHotspots: ['far', 'missing'] })).toEqual(
      lastLightChecks(blockout, { puzzleHotspots: ['far', 'missing'] }),
    )
    expect(lastLightProfile.checks(blockout)).toEqual(lastLightChecks(blockout))
    const puzzle = (hotspots: readonly string[] | null) =>
      lastLightProfile.checks(blockout, { puzzleHotspots: hotspots }).find((r) => r.id === 'puzzle-hotspots')
    expect(puzzle(['far', 'missing'])?.ok).toBe(false)
    expect(puzzle(null)?.ok).toBe(true)
  })

  it('hands every list of the context on to lastLightChecks: materials, lamp kinds, tone and the room policy', () => {
    const blockout = toyBlockout({
      rooms: toyBlockout().rooms.map((room) => ({ ...room, floorTexture: 'marble' })),
      lamps: [
        {
          id: 'l1',
          x: 1,
          y: 3,
          z: 1,
          range: 99,
          radius: 0,
          color: [1, 0.7432941176470589, 0.6078431372549019],
          kind: 'pendant',
        },
      ],
    })
    const context = {
      materials: ['plaster'],
      lampKinds: { pendant: { color: [1, 0.8352941176470589, 0.6078431372549019], range: [5.5, 9] } },
      tone: 0.01,
      roomPolicy: { rooms: { hall: ['a', 'b'] }, zones: {}, masses: {} },
    } as const
    const ran = lastLightProfile.checks(blockout, context)
    expect(ran).toEqual(lastLightChecks(blockout, context))
    const detail = (id: string) => ran.find((result) => result.id === id)?.detail
    expect(detail('materials')).toMatch(/floorTexture marble is not a material/)
    expect(detail('lamps')).toMatch(
      /colour is 0\.\d+ from the archetype's, over 0\.01 \(OKLab\).*range 99 m outside 5.5–9 m/,
    )
    expect(detail('policy')).toMatch(/unassigned sector ab/)
  })

  it('reaches the rooms of a level through the Last Light sector access', () => {
    expect(lastLightProfile.sectors).toBe(lastLightSectorAccess)
    expect(lastLightProfile.sectors.takenIds(toyBlockout())).toEqual(['a', 'b', 'ab'])
  })
})

describe('the af-sector profile', () => {
  it('is the af-sector codec: its id, its parse and its patch', () => {
    expect(afSectorProfile.id).toBe('af-sector')
    const text = loadAuthored('depot.af-sector')
    const level = depot()
    expect(afSectorProfile.patch(text, level, structuredClone(level))).toStrictEqual({ ok: true, text })
  })

  it('draws the depot as one layer of sectors with no nav', () => {
    const { layers } = afSectorProfile.geometry(depot())
    expect(layers).toHaveLength(1)
    const layer = must(layers[0])
    expect(layer.kind).toBe('sectors')
    expect(layer).not.toHaveProperty('nav')
    const expected = resolveMap(buildSectors(depot()))
    expect(layer.map.masses).toEqual([])
    expect(sectorsShape(layer.map)).toEqual(sectorsShape(expected))
    expect(piecesShape(layer.map)).toEqual(piecesShape(expected))
  })

  it('throws the engine’s sentence for a style that does not exist and for a portal to nowhere', () => {
    const style = toyAfSector({ sectors: [{ ...toyHall, style: 'brick' }] })
    expect(geometryError(() => afSectorProfile.geometry(style)).message).toBe('unknown style brick')
    const portal = toyAfSector({ sectors: [toyHall] })
    expect(geometryError(() => afSectorProfile.geometry(portal)).message).toBe(
      'hall: unknown portal target dock',
    )
  })

  it('checks as afSectorChecks does', () => {
    expect(afSectorProfile.checks(depot())).toEqual(afSectorChecks(depot()))
    const broken = toyAfSector({ sectors: [toyHall] })
    expect(afSectorProfile.checks(broken)).toEqual(afSectorChecks(broken))
    expect(afSectorProfile.checks(broken).map((result) => result.id)).toEqual(['ids', 'rooms'])
  })

  it('reaches the sectors of a level through the af-sector access', () => {
    expect(afSectorProfile.sectors).toBe(afSectorAccess)
    expect(afSectorProfile.sectors.takenIds(depot())).toEqual(['hall', 'dock'])
  })
})

describe('the entities of a profile', () => {
  it("are the af-sector kit for an af-sector level and Last Light's fixed kit for a blockout", () => {
    const level = depot()
    expect(afSectorProfile.entities(level)).toEqual(afEntityKit(level))
    const blockout = toyBlockout()
    expect(lastLightProfile.entities(blockout)).toEqual(lastLightEntityKit(blockout))
  })

  it('give every thing a selection id that names it back, the same for both formats', () => {
    const dawn = lastLightProfile.parse(loadFixture('blockout-clinic-dawn'))
    if (!dawn.ok) throw new Error('clinic-dawn does not parse')
    for (const kit of [afSectorProfile.entities(depot()), lastLightProfile.entities(dawn.value)]) {
      expect(kit.things.length).toBeGreaterThan(0)
      for (const thing of kit.things)
        expect(parseSelection(entitySelection(thing.def, thing.id))).toEqual({
          kind: 'entity',
          definition: thing.def,
          id: thing.id,
        })
    }
  })

  it('read the depot as a spawn and a crate and the clinic as the fixed set, without a problem', () => {
    const kit = afSectorProfile.entities(depot())
    expect(kit.things.map((thing) => `${thing.def}/${thing.id}`)).toEqual(['spawn/spawn', 'crate/crate1'])
    expect(kit.problems).toEqual([])
    const dawn = lastLightProfile.parse(loadFixture('blockout-clinic-dawn'))
    if (!dawn.ok) throw new Error('clinic-dawn does not parse')
    expect(lastLightProfile.entities(dawn.value).problems).toEqual([])
  })
})
