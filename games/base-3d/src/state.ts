// base-3d's area and setup (DESIGN.md §3.1): the area content compiled to fixed point once, before the sim is
// made, and the entities the sim starts with. Sim code: `pnpm boundaries` checks it.
import {
  CameraHeading,
  type CameraView,
  cameraViewSchema,
  enterView,
  START,
} from '@mcthaydt/automata-render-pixi3d/sim'
import type { Sim } from '@mcthaydt/automata-sim'
import { z } from 'zod'
import { Hero, HeroControl, Target } from './components.ts'
import { metres } from './constants.ts'

const plan = z.tuple([z.number(), z.number()])
const boxFields = { min: plan, max: plan }
const minNotPastMax = (box: { min: [number, number]; max: [number, number] }): boolean =>
  box.min[0] <= box.max[0] && box.min[1] <= box.max[1]
const planBox = z.strictObject(boxFields).refine(minNotPastMax, { message: 'min must not pass max' })
const point = z.strictObject({ x: z.number(), z: z.number() })
// A view's id is written beside its `camera-view` fields; `cameraViewSchema` (render-pixi3d, the one owner) checks
// the rest.
const viewSource = z.looseObject({ id: z.string().min(1) })

const areaSchema = z.strictObject({
  /** Where Wick starts, in metres. */
  spawn: point,
  /** The area's camera views. */
  views: z.array(viewSource),
  /** Plan boxes, each naming the view the camera takes while Wick is inside. The first that holds him wins. */
  rooms: z.array(
    z
      .strictObject({ view: z.string(), ...boxFields })
      .refine(minNotPastMax, { message: 'min must not pass max' }),
  ),
  /** Plan boxes Wick cannot enter. */
  walls: z.array(planBox),
  /** Where the lock targets stand. */
  targets: z.array(point),
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

/** An area as the sim reads it: Q16.16 metres and compiled views. */
export interface Area {
  readonly spawn: PlanPoint
  readonly views: readonly CameraView[]
  readonly rooms: readonly (PlanBox & { readonly view: string })[]
  readonly walls: readonly PlanBox[]
  readonly targets: readonly PlanPoint[]
}

const toPoint = (p: { x: number; z: number }): PlanPoint => ({ x: metres(p.x), z: metres(p.z) })
const toBox = (b: { min: readonly number[]; max: readonly number[] }): PlanBox => ({
  minX: metres(b.min[0] as number),
  minZ: metres(b.min[1] as number),
  maxX: metres(b.max[0] as number),
  maxZ: metres(b.max[1] as number),
})

/** Checks `source` and converts it to fixed point; throws on a bad field, a repeated view or an unknown view. */
export function compileArea(source: AreaSource): Area {
  const parsed = areaSchema.parse(source)
  const views = parsed.views.map(({ id, ...fields }) => ({ id, ...cameraViewSchema.parse(fields) }))
  const ids = views.map((view) => view.id)
  ids.forEach((id, index) => {
    if (ids.indexOf(id) !== index) throw new Error(`base-3d area: the view "${id}" is defined twice`)
  })
  for (const room of parsed.rooms)
    if (!ids.includes(room.view))
      throw new Error(`base-3d area: a room names the unknown view "${room.view}"`)
  return {
    spawn: toPoint(parsed.spawn),
    views,
    rooms: parsed.rooms.map((room) => ({ view: room.view, ...toBox(room) })),
    walls: parsed.walls.map(toBox),
    targets: parsed.targets.map(toPoint),
  }
}

/** The sim's content as an area; `compileArea` checked it before the sim was made. */
export function areaOf(content: unknown): Area {
  const area = content as Partial<Area> | null
  if (area === null || area.spawn === undefined || !Array.isArray(area.rooms) || !Array.isArray(area.walls))
    throw new Error('base-3d: the sim content is not an area')
  return area as Area
}

/** The view of the first room holding `x`, `z` (min inclusive, max exclusive); undefined outside every room. */
export function viewAt(area: Area, x: number, z: number): CameraView | undefined {
  const room = area.rooms.find((r) => x >= r.minX && x < r.maxX && z >= r.minZ && z < r.maxZ)
  return room === undefined ? undefined : area.views.find((view) => view.id === room.view)
}

/**
 * Spawns Wick at the area's spawn, already in its room's view (the first view never latches) and facing away from
 * the camera, and a target at each of the area's target points.
 */
export function spawnArea(sim: Sim, area: Area): void {
  const view = viewAt(area, area.spawn.x, area.spawn.z)
  const heading = view === undefined ? START : enterView(START, view, { x: 0, y: 0 })
  sim.spawn([
    [Hero, { x: area.spawn.x, z: area.spawn.z, facing: heading.heading }],
    HeroControl,
    [CameraHeading, heading],
  ])
  for (const { x, z } of area.targets) sim.spawn([[Target, { x, z }]])
}

/**
 * Wick, a square of half-size `half` at `x`, `z`, moved by `dx` then `dz` against the area's walls, one axis at a
 * time. A move that would overlap a wall stops flush against its face; a wall he already overlaps does not push
 * him. A tick moves at most 0.07 m and every wall is thicker, so nothing passes through.
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
