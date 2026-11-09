// What a pointer on the plan touches (ED3D.4 step 3): the wall or the sector under it, and the corner near it, in pixels
// that the pointer kind sets. The viewport is 32 px to a metre with the world origin at (20, 20), so a metre is 32 px and
// the cases below read in pixels from a known point.
import { createViewport, type Point as ScreenPoint } from '@automataframework/automata-editor/kit/core'
import { describe, expect, it } from 'vitest'
import type { AfSector, AfSectorEntry } from '../../format/af-sector.schema'
import type { Point } from '../../format/sector.schema'
import { insideSector } from '../../geometry/sectors'
import { afSectorProfile } from '../../profile/af-sector-profile'
import { lastLightProfile } from '../../profile/last-light-profile'
import { loadAuthored, loadFixture } from '../../testing/fixtures'
import { toyAfSector, toyDock, toyHall } from '../../testing/toy-af-sector'
import { selectionOf } from '../selection-of'
import { PICK_RADIUS, type PickOptions, pickCorner, pickPlan } from './plan-pick'
import { PLAN_LIMITS, toScreen } from './plan-viewport'

const viewport = (zoom = 32) =>
  createViewport({ size: { w: 800, h: 600 }, zoom, pan: { x: 20, y: 20 }, limits: PLAN_LIMITS })

/** The screen point of a plan point, moved by `dx` and `dy` pixels. */
const px = (point: Point, dx = 0, dy = 0, zoom = 32): ScreenPoint => {
  const at = toScreen(viewport(zoom), point)
  return { x: at.x + dx, y: at.y + dy }
}

const MOUSE = { radius: PICK_RADIUS.mouse }
const TOUCH = { radius: PICK_RADIUS.touch }

const pickIn = (level: AfSector, at: ScreenPoint, options: PickOptions = TOUCH, zoom = 32) =>
  pickPlan(
    afSectorProfile.geometry(level).layers,
    selectionOf(afSectorProfile, level),
    viewport(zoom),
    at,
    options,
  )

const cornerIn = (level: AfSector, at: ScreenPoint, options: PickOptions = TOUCH) =>
  pickCorner(
    afSectorProfile.geometry(level).layers,
    selectionOf(afSectorProfile, level),
    viewport(),
    at,
    options,
  )

const depot = (): AfSector => {
  const parsed = afSectorProfile.parse(loadAuthored('depot.af-sector'))
  if (!parsed.ok) throw new Error('the depot does not parse')
  return parsed.value
}

const room = (id: string, [x0, z0, x1, z1]: readonly [number, number, number, number]): AfSectorEntry => ({
  id,
  floor: 0,
  ceiling: 4,
  light: 1,
  corners: [
    [x0, z0],
    [x1, z0],
    [x1, z1],
    [x0, z1],
  ],
})

describe('PICK_RADIUS', () => {
  it('is 22 px for a finger (a 44 px target), 12 for a pen and 8 for a mouse', () => {
    expect(PICK_RADIUS).toEqual({ touch: 22, pen: 12, mouse: 8 })
  })
})

describe('pickPlan walls', () => {
  it('hits a wall 10 px away for touch and misses it for a mouse, outside every sector', () => {
    const level = toyAfSector()
    // The hall's south wall runs along z = 6; the pointer is 10 px below it, outside the hall.
    const at = px({ x: 4.5, z: 6 }, 0, 10)
    const hit = pickIn(level, at, TOUCH)
    expect(hit).toMatchObject({ kind: 'wall', selection: 'wall:hall/2', sector: 'hall' })
    if (hit?.kind !== 'wall') throw new Error('not a wall')
    expect(hit.distance).toBeCloseTo(10, 9)
    expect(hit.at.x).toBeCloseTo(4.5, 9)
    expect(hit.at.z).toBeCloseTo(6, 9)
    expect(pickIn(level, at, MOUSE)).toBeUndefined()
  })

  it('answers the nearest of two walls', () => {
    const level = toyAfSector()
    // Outside the hall's north-west corner (0, 0): 10 px above the north wall, or 10 px left of the west one.
    const north = pickIn(level, px({ x: 0, z: 0 }, 6, -10), TOUCH)
    expect(north).toMatchObject({ kind: 'wall', selection: 'wall:hall/0' })
    const west = pickIn(level, px({ x: 0, z: 0 }, -10, 6), TOUCH)
    expect(west).toMatchObject({ kind: 'wall', selection: 'wall:hall/3' })
  })

  it('answers the wall on the side that was touched, on a line two sectors share', () => {
    const level = toyAfSector()
    // The portal pair on x = 8: the hall's wall 1 and the dock's wall 3, at the same distance from the pointer.
    const inHall = pickIn(level, px({ x: 8, z: 3 }, -6, 0), TOUCH)
    const inDock = pickIn(level, px({ x: 8, z: 3 }, 6, 0), TOUCH)
    expect(inHall).toMatchObject({ kind: 'wall', selection: 'wall:hall/1', sector: 'hall' })
    expect(inDock).toMatchObject({ kind: 'wall', selection: 'wall:dock/3', sector: 'dock' })
    if (inHall?.kind !== 'wall' || inDock?.kind !== 'wall') throw new Error('not walls')
    expect(inHall.distance).toBeCloseTo(6, 9)
    expect(inHall.at.x).toBeCloseTo(8, 9)
    expect(inHall.at.z).toBeCloseTo(3, 9)
    expect(inDock.distance).toBeCloseTo(6, 9)
    // Exactly on the line neither side is touched, and the sector that comes first answers.
    expect(pickIn(level, px({ x: 8, z: 3 }), TOUCH)).toMatchObject({ selection: 'wall:hall/1' })
  })

  it('keeps the sector that comes first for two walls on one line that both face the pointer', () => {
    const level = toyAfSector({ sectors: [room('hall', [0, 0, 8, 6]), room('closet', [0, 0, 4, 3])] })
    // Both north walls lie on z = 0 and the pointer is 5 px inside both.
    expect(pickIn(level, px({ x: 2, z: 0 }, 0, 5), TOUCH)).toMatchObject({ selection: 'wall:hall/0' })
  })

  it('beats a sector with the wall under the pointer, and falls back to the sector far from every wall', () => {
    const level = toyAfSector()
    expect(pickIn(level, px({ x: 4, z: 6 }, 0, -6), TOUCH)).toMatchObject({
      kind: 'wall',
      selection: 'wall:hall/2',
    })
    expect(pickIn(level, px({ x: 4, z: 3 }), TOUCH)).toEqual({
      kind: 'sector',
      selection: 'sector:hall',
      sector: 'hall',
    })
    expect(pickIn(level, px({ x: 11, z: 3 }), TOUCH)).toEqual({
      kind: 'sector',
      selection: 'sector:dock',
      sector: 'dock',
    })
  })

  it('answers nothing outside every sector and every radius', () => {
    expect(pickIn(toyAfSector(), px({ x: -4, z: -4 }), TOUCH)).toBeUndefined()
  })

  it('keeps a wall of no length out of the answer, where a repeated corner makes one', () => {
    const level = toyAfSector({
      sectors: [
        {
          ...toyHall,
          corners: [
            [0, 0],
            [0, 0],
            [8, 0],
            [8, 6],
            [0, 6],
          ],
        },
      ],
    })
    const hit = pickIn(level, px({ x: 0, z: 0 }, -5, 0), TOUCH)
    expect(hit).toMatchObject({ kind: 'wall' })
    if (hit?.kind !== 'wall') throw new Error('not a wall')
    expect(hit.distance).toBeCloseTo(5, 9)
    expect(Number.isFinite(hit.at.x) && Number.isFinite(hit.at.z)).toBe(true)
  })

  it('measures the radius in pixels, so the same distance in metres is a different hit at another zoom', () => {
    const level = toyAfSector()
    // A quarter metre below the south wall, outside the hall: 8 px at 32 px to a metre, which a mouse (8 px) reaches.
    const hit = (zoom: number, metres: number) =>
      pickIn(level, px({ x: 4, z: 6 + metres }, 0, 0, zoom), MOUSE, zoom)
    expect(hit(32, 0.25)).toMatchObject({ selection: 'wall:hall/2' })
    expect(hit(32, 0.26)).toBeUndefined()
    expect(hit(16, 0.5)).toMatchObject({ selection: 'wall:hall/2' })
    expect(hit(64, 0.25)).toBeUndefined()
  })

  it('answers the sector for the walls of a hole, which belong to no corner', () => {
    const level = toyAfSector({
      sectors: [
        {
          ...toyHall,
          holes: [
            [
              [2, 2],
              [6, 2],
              [6, 4],
              [2, 4],
            ],
          ],
        },
        toyDock,
      ],
    })
    const hit = pickIn(level, px({ x: 4, z: 2 }, 0, 5), MOUSE)
    expect(hit).toMatchObject({ kind: 'wall', selection: 'sector:hall', sector: 'hall' })
  })
})

describe('pickPlan sectors', () => {
  const tight = { radius: 4 }

  it('answers the smaller of nested sectors', () => {
    const level = toyAfSector({ sectors: [room('hall', [0, 0, 8, 6]), room('closet', [2, 2, 4, 4])] })
    expect(pickIn(level, px({ x: 3, z: 3 }), TOUCH)).toMatchObject({ kind: 'sector', sector: 'closet' })
    expect(pickIn(level, px({ x: 6, z: 3 }), TOUCH)).toMatchObject({ kind: 'sector', sector: 'hall' })
  })

  it('answers the sector that fills a hole and nothing for a hole that is empty', () => {
    const hall: AfSectorEntry = {
      ...room('hall', [0, 0, 10, 8]),
      holes: [
        [
          [2, 2],
          [8, 2],
          [8, 6],
          [2, 6],
        ],
      ],
    }
    const level = toyAfSector({ sectors: [hall, room('island', [3, 3, 7, 5])] })
    expect(pickIn(level, px({ x: 5, z: 4 }), tight)).toMatchObject({ kind: 'sector', sector: 'island' })
    // In the hole and outside the island, 16 px from every wall.
    expect(pickIn(level, px({ x: 2.5, z: 2.5 }, 0, 0), { radius: 3 })).toBeUndefined()
    const empty = toyAfSector({ sectors: [hall] })
    expect(pickIn(empty, px({ x: 5, z: 4 }), tight)).toBeUndefined()
  })
})

describe('pickPlan layers', () => {
  const nearWall = px({ x: 4, z: 6 }, 0, -6)
  const deep = px({ x: 4, z: 3 })

  it('leaves out the walls of a hidden or a locked walls layer, and a sector is still picked', () => {
    for (const options of [
      { ...TOUCH, hidden: ['walls'] },
      { ...TOUCH, locked: ['walls'] },
    ]) {
      expect(pickIn(toyAfSector(), nearWall, options)).toEqual({
        kind: 'sector',
        selection: 'sector:hall',
        sector: 'hall',
      })
    }
  })

  it('leaves out the sectors of a hidden or a locked sectors layer, and a wall is still picked', () => {
    for (const options of [
      { ...TOUCH, hidden: ['sectors'] },
      { ...TOUCH, locked: ['sectors'] },
    ]) {
      expect(pickIn(toyAfSector(), deep, options)).toBeUndefined()
      expect(pickIn(toyAfSector(), nearWall, options)).toMatchObject({
        kind: 'wall',
        selection: 'wall:hall/2',
      })
    }
  })

  it('does nothing for the name of a layer it does not know', () => {
    expect(
      pickIn(toyAfSector(), deep, { ...TOUCH, hidden: ['things:crate'], locked: ['things:crate'] }),
    ).toMatchObject({
      kind: 'sector',
    })
  })
})

describe('pickPlan on a Last Light level', () => {
  const dawn = lastLightProfile.parse(loadFixture('blockout-clinic-dawn'))
  if (!dawn.ok) throw new Error('clinic-dawn does not parse')
  const level = dawn.value
  const layers = lastLightProfile.geometry(level).layers
  const select = selectionOf(lastLightProfile, level)
  const map = layers[0]?.map
  if (map === undefined) throw new Error('clinic-dawn has no sectors layer')
  const connector = map.sectors.find((sector) => sector.id === 'exitWay')
  if (connector === undefined) throw new Error('clinic-dawn has no connector')
  const vp = viewport(64)
  const pickAt = (point: Point) => pickPlan(layers, select, vp, toScreen(vp, point), { radius: 1 })

  it('never answers the connector of an opening, which nothing selects', () => {
    const outline = connector.points[0] ?? []
    const centre = {
      x: outline.reduce((sum, p) => sum + p.x, 0) / outline.length,
      z: outline.reduce((sum, p) => sum + p.z, 0) / outline.length,
    }
    // The centre is in the connector, so it is the connector's missing selection that keeps it out of the answer.
    expect(insideSector(centre, connector)).toBe(true)
    expect(pickAt(centre)).toBeUndefined()
    for (const edge of connector.loops.flat()) {
      const middle = { x: (edge.a.x + edge.b.x) / 2, z: (edge.a.z + edge.b.z) / 2 }
      const hit = pickAt(middle)
      if (hit !== undefined) expect(hit.sector).not.toBe('exitWay')
    }
  })

  it('answers a room of the file', () => {
    expect(pickAt({ x: 0, z: 1 })).toMatchObject({ kind: 'sector', selection: 'sector:hall' })
  })
})

describe('pickCorner', () => {
  it('answers the corner near the pointer by its index in the document, with where it is', () => {
    const hit = cornerIn(depot(), px({ x: 8, z: 0 }, -5, 3), MOUSE)
    expect(hit).toMatchObject({ sector: 'hall', corner: 1, at: { x: 8, z: 0 } })
    expect(hit?.distance).toBeCloseTo(Math.hypot(5, 3), 9)
    expect(cornerIn(depot(), px({ x: 8, z: 6 }, 2, -2), MOUSE)).toMatchObject({ sector: 'dock', corner: 3 })
    expect(cornerIn(depot(), px({ x: 0, z: 6 }, 0, 7), MOUSE)).toMatchObject({ sector: 'hall', corner: 3 })
  })

  it('misses a corner that is further than the radius, and the middle of a wall', () => {
    expect(cornerIn(depot(), px({ x: 8, z: 0 }, -1, 9), MOUSE)).toBeUndefined()
    expect(cornerIn(depot(), px({ x: 8, z: 0 }, -1, 9), TOUCH)).toMatchObject({ sector: 'hall', corner: 1 })
    expect(cornerIn(depot(), px({ x: 4, z: 0 }), TOUCH)).toBeUndefined()
    // The radius itself is a hit: 8 px left of the hall's corner 3 is exactly the reach of a mouse.
    expect(cornerIn(depot(), px({ x: 0, z: 6 }, -8, 0), MOUSE)).toMatchObject({ sector: 'hall', corner: 3 })
    expect(cornerIn(depot(), px({ x: 0, z: 6 }, -8.01, 0), MOUSE)).toBeUndefined()
  })

  it('answers the nearer of two corners', () => {
    const level = toyAfSector({ sectors: [room('hall', [0, 0, 0.5, 6])] })
    expect(cornerIn(level, px({ x: 0, z: 0 }, 5, 0), TOUCH)).toMatchObject({ corner: 0 })
    expect(cornerIn(level, px({ x: 0, z: 0 }, 11, 0), TOUCH)).toMatchObject({ corner: 1 })
  })

  it('answers the sector under the pointer for the corner two sectors share', () => {
    const corner = { x: 8, z: 0 }
    expect(cornerIn(depot(), px(corner, -5, 3), MOUSE)).toMatchObject({ sector: 'hall', corner: 1 })
    expect(cornerIn(depot(), px(corner, 5, 3), MOUSE)).toMatchObject({ sector: 'dock', corner: 0 })
    // Under neither, the sector that comes first.
    expect(cornerIn(depot(), px(corner, 0, -5), MOUSE)).toMatchObject({ sector: 'hall', corner: 1 })
    // Exactly on the shared corner both are at distance 0, and one of the two answers.
    const exact = cornerIn(depot(), px(corner), MOUSE)
    expect(exact?.distance).toBe(0)
    expect(['hall', 'dock']).toContain(exact?.sector)
  })

  it('keeps the sector that comes first for a corner two overlapping sectors share, with the pointer in both', () => {
    const level = toyAfSector({ sectors: [room('hall', [0, 0, 8, 6]), room('closet', [0, 0, 4, 3])] })
    expect(cornerIn(level, px({ x: 0, z: 0 }, 3, 3), MOUSE)).toMatchObject({ sector: 'hall', corner: 0 })
  })

  it('does not take the corners that a pilaster adds round its masonry for the file’s', () => {
    const level = toyAfSector({
      sectors: [
        {
          ...toyHall,
          corners: [
            [0, 0, { pilaster: { start: [2, 1.5] } }],
            [8, 0, { next: 'dock' }],
            [8, 6],
            [0, 6],
          ],
        },
        toyDock,
      ],
    })
    // The notch corner at (2, 1.5) is 2.5 m from the nearest corner of the file: nothing is there to move.
    expect(cornerIn(level, px({ x: 2, z: 1.5 }), TOUCH)).toBeUndefined()
    expect(cornerIn(level, px({ x: 0, z: 0 }), TOUCH)).toMatchObject({ corner: 0 })
  })

  it('leaves out the corners of a hidden or a locked walls layer, whatever the sectors layer is', () => {
    const near = px({ x: 8, z: 0 }, -5, 3)
    for (const options of [
      { ...MOUSE, hidden: ['walls'] },
      { ...MOUSE, locked: ['walls'] },
    ]) {
      expect(cornerIn(depot(), near, options)).toBeUndefined()
    }
    expect(cornerIn(depot(), near, { ...MOUSE, hidden: ['sectors'], locked: ['sectors'] })).toMatchObject({
      corner: 1,
    })
  })
})
