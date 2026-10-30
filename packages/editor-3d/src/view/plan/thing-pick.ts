// What a pointer on the plan touches among the things (ED3D.7b, ED3D spec §5.2 and §6): a point within the pointer
// kind's reach, else a box whose footprint is within it. Points come first, so a lamp or a hotspot inside a big box can
// still be picked; of two the nearest, and of two at one distance the later in the level's order, which is drawn on top.
// The reach is in screen pixels, as for walls. A thing whose sub-layer, or the whole Things layer, is hidden or locked is
// not hit; a thing whose definition the level does not have is not drawn and not hit.
import type { Point as ScreenPoint, Viewport2D } from '@mcthaydt/automata-editor-kit/core'
import { entitySelection } from '../../checks/check'
import type { ThingDef } from '../../entities/thing-def.schema'
import type { EntityKit, Thing } from '../../entities/things'
import type { Point } from '../../format/sector.schema'
import { thingLayer } from '../../model/view-store'
import { isLayerOff, type PickOptions } from './plan-pick'
import { toScreen } from './plan-viewport'

export interface ThingHit {
  readonly def: string
  readonly id: string
  /** `entity:<def>/<id>`. */
  readonly selection: string
  /** The thing's place, in metres. */
  readonly at: Point
  /** From the pointer to the point, or to the nearest edge of the box's footprint (zero inside it), in pixels. */
  readonly distance: number
}

/** Whether the sub-layer of `def` is off: it, or the whole Things layer, is hidden or locked. */
export const isThingLayerOff = (options: Pick<PickOptions, 'hidden' | 'locked'>, def: string): boolean =>
  isLayerOff(options, 'things') || isLayerOff(options, thingLayer(def))

/** A box's half width across x and half depth across z: the definition's `size`, else the thing's own `w` and `d`. */
function halfFootprint(definition: ThingDef, thing: Thing): { readonly x: number; readonly z: number } {
  if (definition.shape === 'point') return { x: 0, z: 0 }
  const side = (value: unknown): number => (typeof value === 'number' && value > 0 ? value / 2 : 0)
  if (definition.size !== undefined) return { x: definition.size[0] / 2, z: definition.size[2] / 2 }
  return { x: side(thing.values.w), z: side(thing.values.d) }
}

/** From `at` to the footprint of the thing on the screen, in pixels; zero inside it. */
function distanceTo(
  viewport: Viewport2D,
  at: ScreenPoint,
  thing: Thing,
  half: { x: number; z: number },
): number {
  const low = toScreen(viewport, { x: thing.x - half.x, z: thing.z - half.z })
  const high = toScreen(viewport, { x: thing.x + half.x, z: thing.z + half.z })
  const outside = (value: number, a: number, b: number): number =>
    Math.max(Math.min(a, b) - value, 0, value - Math.max(a, b))
  return Math.hypot(outside(at.x, low.x, high.x), outside(at.y, low.y, high.y))
}

export function pickThing(
  kit: EntityKit,
  viewport: Viewport2D,
  at: ScreenPoint,
  options: PickOptions,
): ThingHit | undefined {
  const definitions = new Map(kit.definitions.map((definition) => [definition.id, definition]))
  let best: { readonly hit: ThingHit; readonly point: boolean } | undefined
  for (const thing of kit.things) {
    const definition = definitions.get(thing.def)
    if (definition === undefined || isThingLayerOff(options, thing.def)) continue
    const distance = distanceTo(viewport, at, thing, halfFootprint(definition, thing))
    if (distance > options.radius) continue
    const point = definition.shape === 'point'
    // A later thing at the same distance wins: it is drawn on top.
    const better =
      best === undefined || (point && !best.point) || (point === best.point && distance <= best.hit.distance)
    if (better)
      best = {
        point,
        hit: {
          def: thing.def,
          id: thing.id,
          selection: entitySelection(thing.def, thing.id),
          at: { x: thing.x, z: thing.z },
          distance,
        },
      }
  }
  return best?.hit
}
