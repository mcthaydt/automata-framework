// What a pointer on the plan touches among the things (ED3D.7b step 1): a point within the pointer kind's reach, else a
// box whose footprint is within it, over the sub-layers that are on. The viewport is 32 px to a metre with the world
// origin at (20, 20), so the cases read in pixels from a known point.
import { createViewport, type Point as ScreenPoint } from '@automata/editor/kit/core'
import { describe, expect, it } from 'vitest'
import type { ThingDef } from '../../entities/thing-def.schema'
import type { EntityKit, Thing } from '../../entities/things'
import type { Point } from '../../format/sector.schema'
import { lastLightEntityKit } from '../../profile/last-light-entities'
import { toyBlockout } from '../../testing/toy-blockout'
import { PICK_RADIUS, type PickOptions } from './plan-pick'
import { PLAN_LIMITS, toScreen } from './plan-viewport'
import { isThingLayerOff, pickThing } from './thing-pick'

const viewport = createViewport({
  size: { w: 800, h: 600 },
  zoom: 32,
  pan: { x: 20, y: 20 },
  limits: PLAN_LIMITS,
})

/** The screen point of a plan point, moved by `dx` and `dy` pixels. */
const px = (point: Point, dx = 0, dy = 0): ScreenPoint => {
  const at = toScreen(viewport, point)
  return { x: at.x + dx, y: at.y + dy }
}

const definitions: readonly ThingDef[] = [
  { id: 'lamp', shape: 'point', fields: [] },
  { id: 'crate', shape: 'box', size: [2, 1, 1], fields: [] },
]

const thing = (def: string, id: string, x: number, z: number): Thing => ({ def, id, x, z, values: {} })

const kitOf = (...things: Thing[]): EntityKit => ({ definitions, things, problems: [] })

const MOUSE: PickOptions = { radius: PICK_RADIUS.mouse }

describe('thing layers', () => {
  it('is off when its sub-layer or the whole Things layer is hidden or locked', () => {
    expect(isThingLayerOff({}, 'crate')).toBe(false)
    expect(isThingLayerOff({ hidden: ['things:crate'] }, 'crate')).toBe(true)
    expect(isThingLayerOff({ locked: ['things:crate'] }, 'crate')).toBe(true)
    expect(isThingLayerOff({ hidden: ['things'] }, 'crate')).toBe(true)
    expect(isThingLayerOff({ locked: ['things'] }, 'crate')).toBe(true)
    expect(isThingLayerOff({ hidden: ['things:lamp'], locked: ['sectors'] }, 'crate')).toBe(false)
  })
})

describe('picking a point', () => {
  const kit = kitOf(thing('lamp', 'lamp1', 3, 3))

  it('hits a point within the reach of each pointer kind, the boundary included, and not past it', () => {
    for (const kind of ['mouse', 'pen', 'touch'] as const) {
      const radius = PICK_RADIUS[kind]
      expect(pickThing(kit, viewport, px({ x: 3, z: 3 }, radius, 0), { radius })?.id, kind).toBe('lamp1')
      expect(pickThing(kit, viewport, px({ x: 3, z: 3 }, radius + 0.5, 0), { radius }), kind).toBeUndefined()
    }
  })

  it('names the thing, its selection, its place and the distance in pixels', () => {
    expect(pickThing(kit, viewport, px({ x: 3, z: 3 }, 3, 4), MOUSE)).toEqual({
      def: 'lamp',
      id: 'lamp1',
      selection: 'entity:lamp/lamp1',
      at: { x: 3, z: 3 },
      distance: 5,
    })
  })
})

describe('picking a box', () => {
  // A crate 2 m across x and 1 m across z, centred on (5, 5): x from 4 to 6, z from 4.5 to 5.5.
  const kit = kitOf(thing('crate', 'crate1', 5, 5))

  it('hits inside its footprint, at distance zero', () => {
    expect(pickThing(kit, viewport, px({ x: 4.1, z: 5.4 }), MOUSE)).toMatchObject({
      id: 'crate1',
      distance: 0,
    })
  })

  it('hits within the reach of its edge, and not past it', () => {
    expect(pickThing(kit, viewport, px({ x: 6, z: 5 }, 8, 0), MOUSE)?.distance).toBe(8)
    expect(pickThing(kit, viewport, px({ x: 6, z: 5 }, 9, 0), MOUSE)).toBeUndefined()
    expect(pickThing(kit, viewport, px({ x: 5, z: 4.5 }, 0, -8), MOUSE)?.id).toBe('crate1')
    expect(pickThing(kit, viewport, px({ x: 5, z: 4.5 }, 0, -9), MOUSE)).toBeUndefined()
    // Off a corner by 6 px across and 6 px down is 8.49 px away.
    expect(pickThing(kit, viewport, px({ x: 6, z: 5.5 }, 6, 6), MOUSE)).toBeUndefined()
    expect(pickThing(kit, viewport, px({ x: 6, z: 5.5 }, 5, 5), MOUSE)?.id).toBe('crate1')
  })

  it("is sized by the thing's own w and d when the definition has no size (a Last Light box)", () => {
    // The toy's door box stands at (4.0625, 2), 0.12 m across x and 1 m across z.
    const box = lastLightEntityKit(toyBlockout())
    const options = { radius: 2 }
    expect(pickThing(box, viewport, px({ x: 4.0625, z: 2.45 }), options)?.selection).toBe('entity:box/abDoor')
    expect(pickThing(box, viewport, px({ x: 4.0625, z: 2.5 }, 0, 2), options)?.id).toBe('abDoor')
    expect(pickThing(box, viewport, px({ x: 4.0625, z: 2.5 }, 0, 3), options)).toBeUndefined()
    expect(pickThing(box, viewport, px({ x: 4.0625 + 0.06, z: 2 }, 2, 0), options)?.id).toBe('abDoor')
    expect(pickThing(box, viewport, px({ x: 4.0625 + 0.06, z: 2 }, 3, 0), options)).toBeUndefined()
  })

  it('is hit as a point when it has no size to measure (a box with no w and d)', () => {
    const unsized: EntityKit = {
      definitions: [{ id: 'block', shape: 'box', fields: [] }],
      things: [thing('block', 'b1', 5, 5)],
      problems: [],
    }
    expect(pickThing(unsized, viewport, px({ x: 5, z: 5 }, 20, 0), MOUSE)).toBeUndefined()
    expect(pickThing(unsized, viewport, px({ x: 5, z: 5 }), MOUSE)?.id).toBe('b1')
  })
})

describe('choosing between things', () => {
  it('takes a point over a box that holds the pointer', () => {
    const kit = kitOf(thing('lamp', 'lamp1', 5.1, 5), thing('crate', 'crate1', 5, 5))
    expect(pickThing(kit, viewport, px({ x: 5, z: 5 }), MOUSE)?.id).toBe('lamp1')
    // Whichever comes first in the level.
    const boxFirst = kitOf(thing('crate', 'crate1', 5, 5), thing('lamp', 'lamp1', 5.1, 5))
    expect(pickThing(boxFirst, viewport, px({ x: 5, z: 5 }), MOUSE)?.id).toBe('lamp1')
  })

  it('takes the nearest of two, and the later of two at one distance', () => {
    const near = kitOf(thing('lamp', 'a', 3, 3), thing('lamp', 'b', 3.1, 3))
    expect(pickThing(near, viewport, px({ x: 3, z: 3 }, 1, 0), MOUSE)?.id).toBe('a')
    const tied = kitOf(thing('lamp', 'a', 3, 3), thing('lamp', 'b', 3, 3))
    expect(pickThing(tied, viewport, px({ x: 3, z: 3 }), MOUSE)?.id).toBe('b')
    const boxes = kitOf(thing('crate', 'c1', 5, 5), thing('crate', 'c2', 5.5, 5))
    expect(pickThing(boxes, viewport, px({ x: 5.2, z: 5 }), MOUSE)?.id).toBe('c2')
  })

  it('does not hit a thing whose sub-layer is off, and still hits the others', () => {
    const kit = kitOf(thing('lamp', 'lamp1', 5.1, 5), thing('crate', 'crate1', 5, 5))
    const at = px({ x: 5, z: 5 })
    expect(pickThing(kit, viewport, at, { ...MOUSE, hidden: ['things:lamp'] })?.id).toBe('crate1')
    expect(pickThing(kit, viewport, at, { ...MOUSE, locked: ['things:lamp'] })?.id).toBe('crate1')
    expect(pickThing(kit, viewport, at, { ...MOUSE, hidden: ['things'] })).toBeUndefined()
    expect(
      pickThing(kit, viewport, at, { ...MOUSE, locked: ['things:lamp', 'things:crate'] }),
    ).toBeUndefined()
  })

  it('does not hit a thing whose definition the level does not have', () => {
    const kit = kitOf(thing('zone', 'z1', 3, 3))
    expect(pickThing(kit, viewport, px({ x: 3, z: 3 }), MOUSE)).toBeUndefined()
  })
})
