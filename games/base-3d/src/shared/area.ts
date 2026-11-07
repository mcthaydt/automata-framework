// The area: the room's level content compiled to fixed point, and the geometry the systems read. The free game has one
// area: its rooms, walls, pits and camera views, the spawn, the embers and the goal.
import { type CameraView, cameraViewSchema } from '@automata/3d/sim'
import { z } from 'zod'
import { HERO_HALF, metres } from './constants.ts'
import type { Tuning } from './tuning.ts'

const plan = z.tuple([z.number(), z.number()])
const minNotPastMax = (box: { min: [number, number]; max: [number, number] }): boolean =>
  box.min[0] <= box.max[0] && box.min[1] <= box.max[1]
/** A box in plan, `min` and `max` as `[x, z]` metres, with `extra` fields beside them: walls and rooms share it. */
const planBoxWith = <Extra extends z.ZodRawShape>(extra: Extra) =>
  z
    .strictObject({ min: plan, max: plan, ...extra })
    // The generic shape hides `min` and `max` from the callback's type; they are always there.
    .refine((box) => minNotPastMax(box as unknown as Parameters<typeof minNotPastMax>[0]), {
      message: 'min must not pass max',
    })
const planBox = planBoxWith({})
const point = z.strictObject({ x: z.number(), z: z.number() })
// A view's id is written beside its `camera-view` fields; `cameraViewSchema` (@automata/3d, the one owner) checks the rest.
const viewSource = z.looseObject({ id: z.string().min(1) })

const areaSchema = z.strictObject({
  /** The area's name. */
  id: z.string().min(1),
  /** Where Wick starts, in metres. */
  spawn: point,
  /** The area's camera views. */
  views: z.array(viewSource),
  /** Plan boxes, each naming the view the camera takes while Wick is inside. The first that holds him wins. */
  rooms: z.array(planBoxWith({ view: z.string() })),
  /** Plan boxes Wick cannot enter. */
  walls: z.array(planBox),
  /** Plan boxes Wick falls into when his feet cross into one: he is put back on the last safe spot. */
  pits: z.array(planBox),
  /** Where the embers lie, and the goal ember, which is taken last and ends the run. */
  embers: z.array(point),
  goal: point,
})

/** An area as authored: metres, views by id. */
export type AreaSource = z.input<typeof areaSchema>

/** A box in plan, Q16.16 metres. */
export interface PlanBox {
  readonly minX: number
  readonly minZ: number
  readonly maxX: number
  readonly maxZ: number
}
/** A point in plan, Q16.16 metres. */
export interface PlanPoint {
  readonly x: number
  readonly z: number
}

/** An area as the sim reads it: Q16.16 metres and compiled views. It is the sim's content. */
export interface Area {
  readonly id: string
  readonly spawn: PlanPoint
  readonly views: readonly CameraView[]
  readonly rooms: readonly (PlanBox & { readonly view: string })[]
  readonly walls: readonly PlanBox[]
  readonly pits: readonly PlanBox[]
  readonly embers: readonly PlanPoint[]
  readonly goal: PlanPoint
  /** How Wick moves: `content/tuning.toml`'s numbers, part of the sim's content so the replay hash covers them. */
  readonly tuning: Tuning
}

const toPoint = (p: { x: number; z: number }): PlanPoint => ({ x: metres(p.x), z: metres(p.z) })
const toBox = (b: { min: readonly number[]; max: readonly number[] }): PlanBox => ({
  minX: metres(b.min[0] as number),
  minZ: metres(b.min[1] as number),
  maxX: metres(b.max[0] as number),
  maxZ: metres(b.max[1] as number),
})

/**
 * Checks `source` and converts it to fixed point. Throws on a bad field, a repeated view, a room naming an unknown view,
 * and a spawn or an ember outside every room or a spawn whose square (`HERO_HALF` a side) overlaps a wall: Wick would
 * start with no view, or inside a wall that `slide` never pushes him out of.
 */
export function compileArea(source: AreaSource, tuning: Tuning): Area {
  const parsed = areaSchema.parse(source)
  const views = parsed.views.map(({ id, ...fields }) => ({ id, ...cameraViewSchema.parse(fields) }))
  const ids = views.map((view) => view.id)
  for (const [index, id] of ids.entries())
    if (ids.indexOf(id) !== index) throw new Error(`base-3d area: the view "${id}" is defined twice`)
  for (const room of parsed.rooms)
    if (!ids.includes(room.view))
      throw new Error(`base-3d area: a room names the unknown view "${room.view}"`)
  const area: Area = {
    id: parsed.id,
    spawn: toPoint(parsed.spawn),
    views,
    rooms: parsed.rooms.map((room) => ({ view: room.view, ...toBox(room) })),
    walls: parsed.walls.map(toBox),
    pits: parsed.pits.map(toBox),
    embers: parsed.embers.map(toPoint),
    goal: toPoint(parsed.goal),
    tuning,
  }
  const { x, z } = area.spawn
  if (viewAt(area, x, z) === undefined) throw new Error('base-3d area: the spawn is outside every room')
  for (const ember of [...area.embers, area.goal])
    if (viewAt(area, ember.x, ember.z) === undefined)
      throw new Error('base-3d area: an ember is outside every room')
  // Touching a wall's face is allowed; overlapping it is not (the same strict test `slide` uses).
  const blocked = area.walls.some(
    (w) =>
      x + HERO_HALF > w.minX && x - HERO_HALF < w.maxX && z + HERO_HALF > w.minZ && z - HERO_HALF < w.maxZ,
  )
  if (blocked) throw new Error('base-3d area: the spawn overlaps a wall')
  return area
}

/**
 * The sim's content as an area. `compileArea` checked its fields before the sim was made; this only checks the shape,
 * every tick, so content that is not an area fails at once instead of deep inside a system.
 */
export function areaOf(content: unknown): Area {
  const area = content as Partial<Area> | null
  if (
    area === null ||
    typeof area !== 'object' ||
    typeof area.spawn?.x !== 'number' ||
    typeof area.spawn.z !== 'number' ||
    !Array.isArray(area.views) ||
    !Array.isArray(area.rooms) ||
    !Array.isArray(area.walls) ||
    !Array.isArray(area.pits) ||
    !Array.isArray(area.embers) ||
    typeof area.goal?.x !== 'number' ||
    typeof area.tuning?.WALK_PER_TICK !== 'number'
  )
    throw new Error('base-3d: the sim content is not an area')
  return area as Area
}

/** The view of the first room holding `x`, `z` (min inclusive, max exclusive); undefined outside every room. */
export function viewAt(area: Area, x: number, z: number): CameraView | undefined {
  const room = area.rooms.find((r) => x >= r.minX && x < r.maxX && z >= r.minZ && z < r.maxZ)
  return room === undefined ? undefined : area.views.find((view) => view.id === room.view)
}

/**
 * Wick, a square of half-size `half` at `x`, `z`, moved by `dx` then `dz` against the area's walls, one axis at a time.
 * A move that would cross a wall's face stops flush against it; a wall he already overlaps does not push him. The test
 * is on crossing the face from outside, not on landing inside, so a move of any length stops at the first face it
 * meets and never passes through a wall, however thin.
 */
export function slide(
  walls: readonly PlanBox[],
  half: number,
  from: PlanPoint,
  dx: number,
  dz: number,
): PlanPoint {
  let x = from.x + dx
  for (const wall of walls) {
    if (from.z + half <= wall.minZ || from.z - half >= wall.maxZ) continue
    if (dx > 0 && from.x + half <= wall.minX && x + half > wall.minX) x = wall.minX - half
    if (dx < 0 && from.x - half >= wall.maxX && x - half < wall.maxX) x = wall.maxX + half
  }
  let z = from.z + dz
  for (const wall of walls) {
    if (x + half <= wall.minX || x - half >= wall.maxX) continue
    if (dz > 0 && from.z + half <= wall.minZ && z + half > wall.minZ) z = wall.minZ - half
    if (dz < 0 && from.z - half >= wall.maxZ && z - half < wall.maxZ) z = wall.maxZ + half
  }
  return { x, z }
}
