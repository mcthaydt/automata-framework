// Where on an outline the pointer is (ED3D.6b, ED3D.6d, ED3D.6f): the Wall tools put a door or a portal on a wall at that
// place, the Vertex tool a corner, the Split tool the end of a cut. They all measure it the same way, and this is that one
// way.
import type { Viewport2D } from '@mcthaydt/automata-editor/kit/core'
import type { Point } from '../format/sector.schema'
import type { LevelEditor } from '../model/level-editor'
import { parseSelection } from '../model/selection-ref'
import { cornerAt, wallLength } from '../model/wall-geometry'
import type { EditWall } from '../profile/sector-access'
import { isLayerOff, PICK_RADIUS, pickCorner, type WallHit, wallNear } from '../view/plan/plan-pick'
import { snapStep, snapValue } from '../view/plan/plan-viewport'
import type { Geometry } from './geometry-cache'
import type { PlanPointer } from './plan-controller'

/** The wall the pointer is on and where along it. */
export interface WallPlace {
  readonly sector: string
  /** The corner that starts the wall, in the sector's outline as the document writes it. */
  readonly corner: number
  /** What the wall selects: `wall:<sector>/<corner>`. */
  readonly selection: string
  /** In metres. */
  readonly length: number
  /** Metres from the start of the wall: the point of it nearest the pointer, rounded (5 cm, 1 cm with Shift, none with Alt). */
  readonly along: number
  /** The world point at `along`: where a tick, a corner or the end of a cut goes. */
  readonly point: Point
}

export interface PlacedWall {
  readonly place: WallPlace
  /** What the document says the wall is: nothing, a cutaway's name or its members. */
  readonly wall: string | EditWall | undefined
}

/**
 * The place a pointer at a wall hit is at, or nothing when the hit is not a wall that starts at a corner of a sector the
 * level has (a connector's, or one that is gone). `keys` are the pointer's: Shift for the fine step, Alt for none.
 */
export function wallPlaceOf<D>(
  editor: Pick<LevelEditor<D>, 'profile' | 'level'>,
  hit: WallHit,
  keys: { readonly shift?: boolean | undefined; readonly alt?: boolean | undefined },
): PlacedWall | undefined {
  const ref = parseSelection(hit.selection)
  if (ref?.kind !== 'wall') return undefined
  const found = editor.profile.sectors.list(editor.level).find((candidate) => candidate.id === ref.sector)
  const start = found?.corners[ref.corner]
  if (found === undefined || start === undefined) return undefined
  const end = cornerAt(found.corners, ref.corner + 1)
  const length = snapValue(wallLength(found.corners, ref.corner), 0)
  // From the document's start of the wall, the measure `setDoor` and `setWindow` use, not the geometry's.
  const distance = Math.hypot(hit.at.x - start[0], hit.at.z - start[1])
  const along = Math.min(length, snapValue(distance, snapStep({ shiftKey: keys.shift, altKey: keys.alt })))
  // A wall of no length has a neighbour at its point that is as near, and wins the pick, so `length` is not 0 here.
  const fraction = along / length
  return {
    place: {
      sector: ref.sector,
      corner: ref.corner,
      selection: hit.selection,
      length,
      along,
      point: {
        x: snapValue(start[0] + (end[0] - start[0]) * fraction, 0),
        z: snapValue(start[1] + (end[1] - start[1]) * fraction, 0),
      },
    },
    wall: start[2],
  }
}

/** A corner of a sector's outline under the pointer. */
export interface CornerPlace {
  readonly kind: 'corner'
  readonly sector: string
  /** The corner in the sector's outline as the document writes it. */
  readonly corner: number
  readonly point: Point
}

/** What the pointer touches of the outlines: a corner, else a wall and the place along it. */
export type OutlinePlace = CornerPlace | ({ readonly kind: 'wall' } & WallPlace)

/**
 * The corner within the pointer kind's reach (of the sector that holds the pointer when two have one at a point), else the
 * wall within it and the place along that, or nothing. Nothing in a hidden or a locked `walls` layer.
 */
export function outlinePlaceAt<D>(
  editor: Pick<LevelEditor<D>, 'profile' | 'level' | 'view'>,
  { layers, select }: Geometry<D>,
  viewport: Viewport2D,
  at: PlanPointer,
): OutlinePlace | undefined {
  const { hidden, locked } = editor.view.state
  if (isLayerOff({ hidden, locked }, 'walls')) return undefined
  const radius = PICK_RADIUS[at.kind]
  const corner = pickCorner(layers, select, viewport, at, { radius })
  if (corner !== undefined)
    return { kind: 'corner', sector: corner.sector, corner: corner.corner, point: corner.at }
  const hit = wallNear(layers, select, viewport, at, radius)
  const placed = hit === undefined ? undefined : wallPlaceOf(editor, hit, at)
  return placed && { kind: 'wall', ...placed.place }
}
