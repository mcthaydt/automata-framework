// Where a dragged or drawn point lands (ED3D.4 step 4, ED3D spec §5.3 flows 2 and 3 and ED3D-D11): on a corner, on a wall
// line, on the horizontal or vertical through the last point, on the grid, or on the data step, in that order, and the
// answer says which. The viewport is 32 px to a metre with the world origin at (20, 20), as in the picking tests.
import { createViewport, type Point as ScreenPoint } from '@mcthaydt/automata-editor/kit/core'
import { describe, expect, it } from 'vitest'
import type { AfSector, AfSectorEntry } from '../../format/af-sector.schema'
import type { Point } from '../../format/sector.schema'
import { afSectorProfile } from '../../profile/af-sector-profile'
import { toyAfSector } from '../../testing/toy-af-sector'
import { selectionOf } from '../selection-of'
import { gridRounded, type SnapOptions, snapPlan } from './plan-snap'
import { PLAN_LIMITS, toScreen } from './plan-viewport'

const viewport = (zoom = 32) =>
  createViewport({ size: { w: 800, h: 600 }, zoom, pan: { x: 20, y: 20 }, limits: PLAN_LIMITS })

const px = (point: Point, dx = 0, dy = 0, zoom = 32): ScreenPoint => {
  const at = toScreen(viewport(zoom), point)
  return { x: at.x + dx, y: at.y + dy }
}

const GRID = { step: 0.5, snap: true }
const OFF = { step: 0.5, snap: false }
const OPTIONS: SnapOptions = { radius: 12, grid: GRID }

const snap = (
  at: ScreenPoint,
  options: Partial<SnapOptions> = {},
  level: AfSector = toyAfSector(),
  zoom = 32,
) =>
  snapPlan(afSectorProfile.geometry(level).layers, selectionOf(afSectorProfile, level), viewport(zoom), at, {
    ...OPTIONS,
    ...options,
  })

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

/** A point in the middle of the hall, 64 px from every wall: nothing of the level is within reach. */
const open = (x: number, z: number): Point => ({ x, z })

describe('snapPlan targets', () => {
  it('snaps a point near a corner onto it exactly, and says which wall starts there', () => {
    expect(snap(px({ x: 8, z: 6 }, -5, 3))).toEqual({ x: 8, z: 6, kind: 'vertex', target: 'wall:hall/2' })
    expect(snap(px({ x: 0, z: 0 }, 7, -7))).toEqual({ x: 0, z: 0, kind: 'vertex', target: 'wall:hall/0' })
  })

  it('takes the nearest of two corners in reach', () => {
    const level = toyAfSector({ sectors: [room('hall', [0, 0, 0.5, 6])] })
    expect(snap(px({ x: 0, z: 0 }, 4, 0), {}, level)).toMatchObject({ x: 0, z: 0, kind: 'vertex' })
    expect(snap(px({ x: 0, z: 0 }, 11, 0), {}, level)).toMatchObject({ x: 0.5, z: 0, kind: 'vertex' })
  })

  it('takes a corner exactly at its reach, and not a pixel past it', () => {
    expect(snap(px({ x: 0, z: 0 }, -12, 0))).toMatchObject({ x: 0, z: 0, kind: 'vertex' })
    expect(snap(px({ x: 0, z: 0 }, -12.01, 0))).not.toMatchObject({ kind: 'vertex' })
  })

  it('does not snap to what nothing selects, such as the corners and walls of an opening connector', () => {
    const level = toyAfSector()
    const select = selectionOf(afSectorProfile, level)
    const blind = {
      ...select,
      edge: (edge: Parameters<typeof select.edge>[0]) =>
        edge.sector.id === 'dock' ? undefined : select.edge(edge),
    }
    const layers = afSectorProfile.geometry(level).layers
    // The dock's far corner (14, 6) and its east wall belong to a sector that has no selection.
    const near = snapPlan(layers, blind, viewport(), px({ x: 14, z: 6 }, -4, -3), OPTIONS)
    expect(near).toMatchObject({ kind: 'grid' })
    expect(snapPlan(layers, blind, viewport(), px({ x: 14, z: 3 }, -5, 0), OPTIONS)).toMatchObject({
      kind: 'grid',
    })
  })

  it('prefers a corner to a wall line that is nearer to the pointer', () => {
    // 1 px below the north wall and 6 px right of its corner.
    expect(snap(px({ x: 0, z: 0 }, 6, 1))).toMatchObject({ x: 0, z: 0, kind: 'vertex' })
  })

  it('snaps a point near a wall, away from its corners, onto the line, and says which wall', () => {
    const hit = snap(px({ x: 4.4, z: 6 }, 0, 5))
    expect(hit).toEqual({ x: 4.4, z: 6, kind: 'wall', target: 'wall:hall/2' })
    // Kept to four decimals, and not moved to the grid.
    expect(snap(px({ x: 4.123456, z: 6 }, 0, -5))).toEqual({
      x: 4.1235,
      z: 6,
      kind: 'wall',
      target: 'wall:hall/2',
    })
  })

  it('names the wall on the side that was touched, for a line two sectors share', () => {
    expect(snap(px({ x: 8, z: 3 }, -5, 0))).toEqual({ x: 8, z: 3, kind: 'wall', target: 'wall:hall/1' })
    expect(snap(px({ x: 8, z: 3 }, 5, 0))).toEqual({ x: 8, z: 3, kind: 'wall', target: 'wall:dock/3' })
  })

  it('leaves out the corners and walls of a hidden or a locked walls layer', () => {
    for (const layer of [{ hidden: ['walls'] }, { locked: ['walls'] }]) {
      expect(snap(px({ x: 0, z: 0 }, 3, 2), layer)).toMatchObject({ kind: 'grid' })
      expect(snap(px({ x: 4.4, z: 6 }, 0, 5), layer)).toMatchObject({ kind: 'grid' })
    }
    expect(snap(px({ x: 0, z: 0 }, 3, 2), { hidden: ['sectors'], locked: ['sectors'] })).toMatchObject({
      kind: 'vertex',
    })
  })

  it('measures its reach in pixels: the same distance in metres is out of reach when zoomed in', () => {
    // A quarter metre from the corner (0, 0): 8 px at 32 px to a metre, 16 px at 64.
    expect(snap(px({ x: 0.25, z: 0 }, 0, 0, 32), {}, toyAfSector(), 32)).toMatchObject({ kind: 'vertex' })
    expect(snap(px({ x: 0.25, z: 0 }, 0, 0, 64), {}, toyAfSector(), 64)).not.toMatchObject({ kind: 'vertex' })
  })
})

describe('snapPlan axis', () => {
  const from = { x: 2, z: 2 }

  it('locks the horizontal through the last point and snaps the other coordinate to the grid', () => {
    expect(snap(px(open(5.13, 2), 0, 4), { from })).toEqual({ x: 5, z: 2, kind: 'axis' })
  })

  it('locks the vertical through the last point', () => {
    expect(snap(px(open(2, 4.26), -4, 0), { from })).toEqual({ x: 2, z: 4.5, kind: 'axis' })
  })

  it('locks an axis exactly at its reach, and not a pixel past it', () => {
    // 12 px below the horizontal through the last point, then 12 px beside the vertical through it.
    expect(snap(px(open(5, 2), 0, 12), { from })).toEqual({ x: 5, z: 2, kind: 'axis' })
    expect(snap(px(open(5, 2), 0, 12.01), { from })).toMatchObject({ kind: 'grid' })
    expect(snap(px(open(2, 5), -12, 0), { from })).toEqual({ x: 2, z: 5, kind: 'axis' })
    expect(snap(px(open(2, 5), -12.01, 0), { from })).toMatchObject({ kind: 'grid' })
  })

  it('snaps the other coordinate to the data step when the grid is off, and to 1 cm with shift', () => {
    expect(snap(px(open(5.13, 2), 0, 4), { from, grid: OFF })).toEqual({ x: 5.15, z: 2, kind: 'axis' })
    expect(snap(px(open(5.13, 2), 0, 4), { from, shiftKey: true })).toEqual({ x: 5.13, z: 2, kind: 'axis' })
  })

  it('does not lock an axis that is further than the reach', () => {
    expect(snap(px(open(5.13, 2.6), 0, 0), { from })).toEqual({ x: 5, z: 2.5, kind: 'grid' })
  })

  it('takes the axis the pointer is nearer to when it is within reach of both', () => {
    // 9.6 px right of the last point and 3.2 px below it: the horizontal through it is nearer, and x goes to the grid.
    expect(snap(px({ x: 2.3, z: 2.1 }), { from })).toEqual({ x: 2.5, z: 2, kind: 'axis' })
    expect(snap(px({ x: 2.1, z: 2.3 }), { from })).toEqual({ x: 2, z: 2.5, kind: 'axis' })
    // As near to both: the horizontal.
    expect(snap(px(from, 5, 5), { from })).toEqual({ x: 2, z: 2, kind: 'axis' })
    expect(snap(px({ x: 2.3, z: 2.3 }), { from })).toEqual({ x: 2.5, z: 2, kind: 'axis' })
  })

  it('is for the last point only: with none, a point on a horizontal is just on the grid', () => {
    expect(snap(px(open(5.13, 2), 0, 4))).toEqual({ x: 5, z: 2, kind: 'grid' })
  })

  it('gives way to a wall and to a corner', () => {
    // On the horizontal through (2, 6) and 5 px from the south wall: the wall wins.
    expect(snap(px({ x: 4.4, z: 6 }, 0, -5), { from: { x: 2, z: 6 } })).toMatchObject({ kind: 'wall' })
  })
})

describe('snapPlan grid and data step', () => {
  const free = open(3.31234, 2.93456)

  it('goes to the grid when the view snaps to it', () => {
    expect(snap(px(free))).toEqual({ x: 3.5, z: 3, kind: 'grid' })
    expect(snap(px(free), { grid: { step: 0.25, snap: true } })).toEqual({ x: 3.25, z: 3, kind: 'grid' })
  })

  it('goes to 5 cm when the grid is off, 1 cm with shift', () => {
    expect(snap(px(free), { grid: OFF })).toEqual({ x: 3.3, z: 2.95, kind: 'data' })
    expect(snap(px(free), { shiftKey: true })).toEqual({ x: 3.31, z: 2.93, kind: 'data' })
    expect(snap(px(free), { grid: OFF, shiftKey: true })).toEqual({ x: 3.31, z: 2.93, kind: 'data' })
  })

  it('is the point itself with alt, to four decimals, and no corner or wall either', () => {
    expect(snap(px(free), { altKey: true })).toEqual({ x: 3.3123, z: 2.9346, kind: 'free' })
    expect(snap(px({ x: 0, z: 0 }, 3, 2), { altKey: true })).not.toHaveProperty('target')
    expect(snap(px({ x: 0, z: 0 }, 3, 2), { altKey: true })).toMatchObject({ kind: 'free' })
    expect(snap(px(open(5.13, 2), 0, 4), { from: { x: 2, z: 2 }, altKey: true })).toMatchObject({
      kind: 'free',
    })
  })

  it('has no target for a point that is not on a corner or a wall', () => {
    expect(snap(px(free))).not.toHaveProperty('target')
  })

  it('falls back to the data step for a grid with no step, rather than not snapping', () => {
    expect(snap(px(free), { grid: { step: 0, snap: true } })).toEqual({ x: 3.3, z: 2.95, kind: 'data' })
  })

  it('never answers -0', () => {
    const out = snap(px({ x: -4.01, z: -4.02 }), { grid: { step: 0.5, snap: true } })
    expect(out.x).toBe(-4)
    const zero = snap(px({ x: -0.01, z: -0.01 }), { grid: OFF, hidden: ['walls'] })
    expect(Object.is(zero.x, 0)).toBe(true)
    expect(Object.is(zero.z, 0)).toBe(true)
    const grid = snap(px({ x: -0.1, z: -0.1 }), { hidden: ['walls'] })
    expect(Object.is(grid.x, 0) && Object.is(grid.z, 0)).toBe(true)
  })
})

describe('gridRounded', () => {
  const grid = { step: 0.5, snap: true }

  it('rounds a length to the grid, to the centimetre with Shift and not at all with Alt', () => {
    expect(gridRounded(1.3, { grid })).toBe(1.5)
    expect(gridRounded(-0.7, { grid })).toBe(-0.5)
    expect(gridRounded(1.237, { grid, shiftKey: true })).toBe(1.24)
    expect(gridRounded(1.237, { grid, altKey: true })).toBe(1.237)
  })

  it('rounds to the data step when the grid does not snap', () => {
    expect(gridRounded(1.237, { grid: { step: 0.5, snap: false } })).toBe(1.25)
  })
})
