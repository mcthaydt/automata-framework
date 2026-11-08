// What the plan paints (ED3D.4 step 2, ED3D spec §6): a draw list, not a drawing. Fills are the sectors' floors seen from
// above, walls are one segment for each physical line classified by what is in them, and each carries the selection id
// the app selects it by. It reads the geometry layers alone (ED3D spec §4.3), so the plan can never disagree with the
// meshes or the checks; the painting, with its colours, strokes and labels, is the app's.

import type { Point } from '@automata/3d/level'
import type { Rect } from '@automata/editor/kit/core'
import type { SelectionOf } from '../../../shared/edit/selection-of'
import type { Edge, Sector } from '../../../shared/geometry/sectors'
import type { GeometryLayer } from '../../../shared/level-session/level-profile'
import { levelBounds } from './plan-viewport'

export type WallKind = 'solid' | 'portal' | 'door' | 'window'

export interface PlanFill {
  readonly sector: string
  /** Nothing for a sector that only the geometry has (an opening's connector). */
  readonly selection: string | undefined
  readonly outline: readonly Point[]
  readonly holes: readonly (readonly Point[])[]
  /** What the fill is coloured by: the sector's zone, else its floor texture, else nothing. */
  readonly group: string
  readonly floor: number
  readonly ceiling: number
  readonly light: number
}

export interface PlanWall {
  readonly sector: string
  readonly selection: string | undefined
  readonly a: Point
  readonly b: Point
  readonly kind: WallKind
  /** A door's or a window's extent along the wall, in metres from `a`, held inside the wall; not on other walls. */
  readonly span?: readonly [number, number]
}

export interface PlanScene {
  readonly fills: readonly PlanFill[]
  readonly walls: readonly PlanWall[]
  readonly bounds: Rect
}

export interface PlanSceneOptions {
  /** The layers that are not drawn: `sectors` leaves out the fills and `walls` the walls. */
  readonly hidden?: readonly string[] | undefined
}

function fillOf(sector: Sector, select: SelectionOf): PlanFill {
  return {
    sector: sector.id,
    selection: select.sector(sector.id),
    outline: sector.points[0] ?? [],
    holes: sector.points.slice(1),
    group: sector.zone !== '' ? sector.zone : (sector.floorTexture ?? ''),
    floor: sector.floor,
    ceiling: sector.ceiling,
    light: sector.light,
  }
}

/** A portal's frame is part of the portal; only a wall that leads nowhere is a door or a window. */
function kindOf(edge: Edge): WallKind {
  if (edge.next !== undefined) return 'portal'
  if (edge.wall.door !== undefined) return 'door'
  if (edge.wall.window !== undefined) return 'window'
  return 'solid'
}

const clamp = (value: number, low: number, high: number): number => Math.min(high, Math.max(low, value))

/** `at` is the centre of the door or the window, in metres from the start of the wall. */
function spanOf(edge: Edge): readonly [number, number] | undefined {
  const cut = edge.wall.door ?? edge.wall.window
  if (cut === undefined) return undefined
  return [clamp(cut.at - cut.width / 2, 0, edge.length), clamp(cut.at + cut.width / 2, 0, edge.length)]
}

/** The same key for a wall and for its reverse: the two ends in tenths of a millimetre, in a fixed order. */
function lineKey(a: Point, b: Point): string {
  const ends = [a, b].map((p) => `${Math.round(p.x * 1e4)},${Math.round(p.z * 1e4)}`)
  return ends.sort().join('|')
}

/**
 * The walls of a layer, one for each physical line. The two walls of a portal pair are one line and are drawn once, as
 * the wall of the sector that comes first (a picker that needs the side that was touched reads the layers).
 */
function wallsOf(layers: readonly GeometryLayer[], select: SelectionOf): PlanWall[] {
  const walls: PlanWall[] = []
  const portals = new Set<string>()
  for (const layer of layers) {
    for (const edge of layer.map.edges) {
      if (edge.next !== undefined) {
        const key = lineKey(edge.a, edge.b)
        if (portals.has(key)) continue
        portals.add(key)
      }
      const kind = kindOf(edge)
      const span = kind === 'door' || kind === 'window' ? spanOf(edge) : undefined
      const wall: PlanWall = {
        sector: edge.sector.id,
        selection: select.edge(edge),
        a: edge.a,
        b: edge.b,
        kind,
      }
      walls.push(span === undefined ? wall : { ...wall, span })
    }
  }
  return walls
}

export function planScene(
  layers: readonly GeometryLayer[],
  select: SelectionOf,
  options: PlanSceneOptions = {},
): PlanScene {
  const hidden = options.hidden ?? []
  return {
    fills: hidden.includes('sectors')
      ? []
      : layers.flatMap((layer) => layer.map.sectors.map((sector) => fillOf(sector, select))),
    walls: hidden.includes('walls') ? [] : wallsOf(layers, select),
    bounds: levelBounds(layers),
  }
}
