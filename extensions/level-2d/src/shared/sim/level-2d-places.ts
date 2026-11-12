import type { ContentEntityDef, ContentLevel, ContentProject } from '@automata/content/level-2d'
import { entitiesOf, intGridRows } from '@automata/content/level-2d'
import { blockedWith, crossingThrough, type Places, type PlanCrossing, type PlanRoom } from '@automata/places'
import type { ComponentDef } from '@automata/sim'
import { cellWalls } from './cell-walls.ts'
import { Level2dAt } from './level-2d.component.ts'

// `level2dPlaces`: a 2D level as the plan the other extensions read. The plan is in metres and the level in pixels, so the
// pixels are converted here and nowhere else: one metre is `metre` pixels, by default a cell of the walls layer.

/** Where a 2D game keeps a walker's position: its own component, and the names of its two fields, in level pixels. */
export interface Level2dPosition {
  readonly component: ComponentDef
  readonly x: string
  readonly y: string
}

export interface Level2dPlacesOptions {
  readonly level: ContentLevel
  readonly project: ContentProject
  /** The game's own position component. Default: the extension's `Level2dAt`. */
  readonly position?: Level2dPosition
  /** Level pixels to a metre. Default: the walls layer's grid, else 16. */
  readonly metre?: number
  /** The tag that makes a definition an area (a room). Default `area`. */
  readonly areas?: string
  /** The IntGrid layer that holds the walls. Default: the project's first IntGrid layer, if any. */
  readonly walls?: string
  /** The IntGrid values that are solid. Default: the values called `solid`. */
  readonly solid?: readonly number[]
}

interface Rect {
  readonly left: number
  readonly top: number
  readonly right: number
  readonly bottom: number
}

const EDGE = 1e-9
const textOf = (value: unknown): string | undefined =>
  typeof value === 'string' && value !== '' ? value : undefined

/** The rectangle of a placed area in metres: its pivot point is where it is stored, and `w`/`h` override the size. */
function rectOf(
  def: ContentEntityDef,
  item: { x: number; y: number; w?: number | undefined; h?: number | undefined },
  metre: number,
): Rect {
  const w = item.w ?? def.size.w
  const h = item.h ?? def.size.h
  const left = (item.x - def.pivot.x * w) / metre
  const top = (item.y - def.pivot.y * h) / metre
  return { left, top, right: left + w / metre, bottom: top + h / metre }
}

/** Where rectangles `from` and `to` share an edge of positive length: its middle and the unit normal pointing into `from`. */
function sharedEdge(
  from: Rect,
  to: Rect,
): { middle: { x: number; z: number }; normal: { x: number; z: number } } | null {
  const overlap = (a0: number, a1: number, b0: number, b1: number): [number, number] | null => {
    const low = Math.max(a0, b0)
    const high = Math.min(a1, b1)
    return high - low > EDGE ? [low, high] : null
  }
  const near = (a: number, b: number): boolean => Math.abs(a - b) <= EDGE
  const rows = overlap(from.top, from.bottom, to.top, to.bottom)
  const cols = overlap(from.left, from.right, to.left, to.right)
  if (rows !== null && near(from.right, to.left))
    return { middle: { x: from.right, z: (rows[0] + rows[1]) / 2 }, normal: { x: -1, z: 0 } }
  if (rows !== null && near(from.left, to.right))
    return { middle: { x: from.left, z: (rows[0] + rows[1]) / 2 }, normal: { x: 1, z: 0 } }
  if (cols !== null && near(from.bottom, to.top))
    return { middle: { x: (cols[0] + cols[1]) / 2, z: from.bottom }, normal: { x: 0, z: -1 } }
  if (cols !== null && near(from.top, to.bottom))
    return { middle: { x: (cols[0] + cols[1]) / 2, z: from.top }, normal: { x: 0, z: 1 } }
  return null
}

/** The wall layer and the values that are solid; none when the project has no IntGrid layer and none was asked for. */
function wallsOf(
  options: Level2dPlacesOptions,
): { rows: readonly (readonly number[])[]; grid: number; solid: readonly number[] } | null {
  const layer = options.project.layers.find(
    (each) => each.kind === 'intgrid' && (options.walls === undefined || each.id === options.walls),
  )
  if (layer === undefined || layer.kind !== 'intgrid') {
    if (options.walls !== undefined)
      throw new Error(`The project has no IntGrid layer called "${options.walls}".`)
    return null
  }
  const solid =
    options.solid ?? layer.values.filter((value) => value.id === 'solid').map((value) => value.value)
  if (solid.length === 0)
    throw new Error(
      `The "${layer.id}" layer has no value called "solid". Name one in the project, or pass \`solid\`.`,
    )
  return { rows: intGridRows(options.level, layer.id), grid: layer.grid, solid }
}

/** The areas and walls of a level in metres, which `level2dPlaces` and `level2dLintFloor` both read, so they cannot disagree. */
function floorOf(options: Level2dPlacesOptions) {
  const walls = wallsOf(options)
  const metre = options.metre ?? walls?.grid ?? 16
  const tag = options.areas ?? 'area'
  const areaDefs = new Map(
    options.project.entities.filter((def) => def.tags.includes(tag)).map((def) => [def.id, def]),
  )
  const areas: { room: PlanRoom; rect: Rect }[] = []
  for (const layer of options.level.layers) {
    if (layer.kind !== 'entities') continue
    for (const item of entitiesOf(options.level, layer.def)) {
      const def = areaDefs.get(item.def)
      if (def === undefined) continue
      const id = textOf(item.fields.name) ?? item.id
      areas.push({ room: { id, zone: textOf(item.fields.zone) ?? id }, rect: rectOf(def, item, metre) })
    }
  }
  const blocked = walls === null ? () => false : cellWalls(walls.rows, walls.grid / metre, walls.solid)
  /** The index of the area a point is in, or -1. Closed rectangles in file order: the first area wins, and a point on a shared edge belongs to it. */
  const areaAt = (p: { x: number; z: number }): number =>
    areas.findIndex(
      ({ rect }) => p.x >= rect.left && p.x <= rect.right && p.z >= rect.top && p.z <= rect.bottom,
    )
  return { metre, areas, blocked, areaAt }
}

/**
 * The floor a cutscene lint checks a scene against (`LintFloor` in `@automata/cutscenes/tools`): which area a point in
 * metres is in, and whether a walk is blocked by a wall. It reads the same areas and walls as `level2dPlaces`, so what the
 * lint calls floor is what the game lets a character walk on. A level with no areas has no floor to judge, so every point
 * counts as floor there.
 */
export function level2dLintFloor(options: Level2dPlacesOptions): {
  sectorAt(p: { readonly x: number; readonly z: number }): unknown
  segmentBlocked(
    a: { readonly x: number; readonly z: number },
    b: { readonly x: number; readonly z: number },
    margin: number,
  ): boolean
} {
  const { areas, blocked, areaAt } = floorOf(options)
  return {
    sectorAt: (p) => (areas.length === 0 ? 'level' : areas[areaAt(p)]?.room.id),
    segmentBlocked: (a, b, margin) => blocked(a, b, margin),
  }
}

/**
 * A 2D level as `Places`: its areas as rooms, its solid cells as walls, and the game's own position component.
 *
 * It describes ONE level. A game with several levels builds one `level2dPlaces` for the level it needs (the rooms,
 * walls and crossings are that level's); the places do not follow the level the player is in, because `Places` does not
 * ask the sim which level is current. Two levels in one game's AI or dialogue need the game to say which one.
 */
export function level2dPlaces(options: Level2dPlacesOptions): Places {
  const { metre, areas, blocked, areaAt } = floorOf(options)
  const position = options.position ?? { component: Level2dAt, x: 'x', y: 'y' }
  const rooms: readonly PlanRoom[] = areas.map((area) => area.room)
  const roomAt = (_: unknown, p: { x: number; z: number }): number => areaAt(p) + 1
  const at: Places['at'] = (ctx, sid) => {
    const walker = ctx.entity(sid)
    if (walker === undefined || !walker.has(position.component)) return undefined
    const values = walker.get(position.component) as Record<string, number>
    return { x: (values[position.x] as number) / metre, z: (values[position.y] as number) / metre }
  }
  return {
    provider: 'level-2d',
    at,
    move: (ctx, sid, to) => {
      ctx.entity(sid)?.set(position.component, { [position.x]: to.x * metre, [position.y]: to.z * metre })
    },
    spawnAt: (p) => [[position.component, { [position.x]: p.x * metre, [position.y]: p.z * metre }]],
    rooms: () => rooms,
    roomAt,
    // A 2D position is the room's own: there is no step in between to lag behind.
    roomOf: (ctx, sid) => {
      const here = at(ctx, sid)
      return here === undefined ? 0 : roomAt(ctx, here)
    },
    walk: (_, doors) => blockedWith(blocked, doors),
    sight: (_, doors) => blockedWith(blocked, doors),
    crossing(_, from, to): PlanCrossing | null {
      const a = areas.find((area) => area.room.id === from)
      const b = areas.find((area) => area.room.id === to)
      if (a === undefined || b === undefined) return null
      const edge = sharedEdge(a.rect, b.rect)
      return edge === null ? null : crossingThrough(edge.middle, edge.normal)
    },
  }
}
