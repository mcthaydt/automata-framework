// The area: the level content compiled to fixed point, and the geometry the systems read.
import { type CameraView, cameraViewSchema } from '@mcthaydt/automata-render-pixi3d/sim'
import { sortedEntries } from '@mcthaydt/automata-sim'
import { z } from 'zod'
import { ENEMIES, ENEMY_MOVES } from '../constants/enemies.ts'
import { ENTITY_DEFS, type EntityDefName, type EntitySource } from '../constants/entities.ts'
import { HERO_HALF, HERO_MOVES, type MoveDef, metres } from '../constants/index.ts'
import { ITEM_MOVES } from '../constants/items.ts'

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
// A view's id is written beside its `camera-view` fields; `cameraViewSchema` (render-pixi3d, the one owner) checks
// the rest.
const viewSource = z.looseObject({ id: z.string().min(1) })

const areaSchema = z.strictObject({
  /** The area's name, which exits use to lead to it. */
  id: z.string().min(1),
  /** Where Wick starts, in metres. */
  spawn: point,
  /** The area's camera views. */
  views: z.array(viewSource),
  /** Plan boxes, each naming the view the camera takes while Wick is inside. The first that holds him wins. */
  rooms: z.array(planBoxWith({ view: z.string() })),
  /** Plan boxes Wick cannot enter. */
  walls: z.array(planBox),
  /** Where the lock targets stand. */
  targets: z.array(point),
  /** Where the ember lies: a pickup within `EMBER_REACH` of it takes it and ends the run. */
  ember: point,
  /** Plan boxes that lead to the area `to`, where Wick arrives at `entry` (metres). */
  exits: z.array(planBoxWith({ to: z.string().min(1), entry: point })).default([]),
  /** Plan boxes Wick falls into when his feet cross into one (DESIGN.md §7.8). */
  pits: z.array(planBox).default([]),
  /** The enemies standing in the area (DESIGN.md §8.2): a type by id, where, and a facing in degrees (0 toward +z). */
  /**
   * The dungeon pieces (DESIGN.md §10), in af-sector/1's entity shape: each is checked against its definition's
   * schema (constants/entities.ts) by `compileArea`, which names the JSON path of anything wrong (G3-F2).
   */
  entities: z
    .array(z.looseObject({ def: z.string(), id: z.string(), x: z.number(), z: z.number() }))
    .default([]),
  /** Where an angry Captain's calls come out (DESIGN.md §8.3), in metres. */
  vents: z.array(point).default([]),
  foes: z
    .array(z.strictObject({ kind: z.string(), x: z.number(), z: z.number(), facing: z.number().default(0) }))
    .default([]),
})

/** An area as authored: metres, views by id. */
export type AreaSource = Omit<z.input<typeof areaSchema>, 'entities'> & {
  readonly entities?: readonly EntitySource[] | undefined
}

/**
 * An area that cannot be loaded: the area's id, the JSON path of the field at fault (`entities[3].lock`) and why,
 * as ED3D's locator finds them (G3-F2).
 */
export class AreaLoadError extends Error {
  readonly area: string
  readonly path: string
  constructor(area: string, path: string, reason: string) {
    super(`base-3d area "${area}": ${path}: ${reason}`)
    this.name = 'AreaLoadError'
    this.area = area
    this.path = path
  }
}

/**
 * A dungeon piece as the sim reads it: its definition, its id, its place and every field of its definition, with
 * lengths (`x`, `z`, `width`, `depth`, `height`) in Q16.16 metres.
 */
export interface AreaEntity extends PlanPoint {
  readonly def: EntityDefName
  readonly id: string
  readonly [field: string]: unknown
}

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

/** An exit as the sim reads it: the box, the area it leads to by id, and where Wick arrives there. */
export interface AreaExitBox extends PlanBox {
  readonly to: string
  readonly entry: PlanPoint
}

/** A foe as the sim spawns it: its type's index + 1 in `ENEMIES`, its place and its facing in turn units. */
export interface AreaFoe extends PlanPoint {
  readonly kind: number
  readonly facing: number
}

/** An area as the sim reads it: Q16.16 metres and compiled views. */
export interface Area {
  readonly id: string
  readonly spawn: PlanPoint
  readonly views: readonly CameraView[]
  readonly rooms: readonly (PlanBox & { readonly view: string })[]
  readonly walls: readonly PlanBox[]
  readonly targets: readonly PlanPoint[]
  readonly ember: PlanPoint
  readonly exits: readonly AreaExitBox[]
  readonly pits: readonly PlanBox[]
  readonly foes: readonly AreaFoe[]
  readonly vents: readonly PlanPoint[]
  /** The hook posts: the `hook-post` entities' places. */
  readonly posts: readonly PlanPoint[]
  readonly entities: readonly AreaEntity[]
}

/** The sim's content: every area, the first being where a new game starts. */
export interface World {
  readonly areas: readonly Area[]
  /** Every move a fighter can make (DESIGN.md §7.2, §8.2): Wick's, then the enemies'. */
  readonly moves: readonly MoveDef[]
}

const toPoint = (p: { x: number; z: number }): PlanPoint => ({ x: metres(p.x), z: metres(p.z) })
const toBox = (b: { min: readonly number[]; max: readonly number[] }): PlanBox => ({
  minX: metres(b.min[0] as number),
  minZ: metres(b.min[1] as number),
  maxX: metres(b.max[0] as number),
  maxZ: metres(b.max[1] as number),
})

/**
 * Checks `source` and converts it to fixed point. Throws on a bad field, a repeated view, a room naming an unknown
 * view, and a spawn outside every room or whose square (`HERO_HALF` a side) overlaps a wall: Wick would start
 * with no view, or inside a wall that `slide` never pushes him out of.
 */
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
  const entities = compileEntities(parsed.id, source.entities ?? [])
  const area: Area = {
    id: parsed.id,
    spawn: toPoint(parsed.spawn),
    views,
    rooms: parsed.rooms.map((room) => ({ view: room.view, ...toBox(room) })),
    walls: parsed.walls.map(toBox),
    targets: parsed.targets.map(toPoint),
    ember: toPoint(parsed.ember),
    exits: parsed.exits.map((exit) => ({ ...toBox(exit), to: exit.to, entry: toPoint(exit.entry) })),
    pits: parsed.pits.map(toBox),
    vents: parsed.vents.map(toPoint),
    posts: entities.filter((entity) => entity.def === 'hook-post').map(({ x, z }) => ({ x, z })),
    entities,
    foes: parsed.foes.map((foe) => {
      const kind = ENEMIES.findIndex((type) => type.id === foe.kind) + 1
      if (kind === 0) throw new Error(`base-3d area: a foe names the unknown enemy "${foe.kind}"`)
      const facing = Math.round((foe.facing * 65_536) / 360)
      return { kind, ...toPoint(foe), facing: ((facing % 65_536) + 65_536) % 65_536 }
    }),
  }
  const { x, z } = area.spawn
  if (viewAt(area, x, z) === undefined) throw new Error('base-3d area: the spawn is outside every room')
  if (viewAt(area, area.ember.x, area.ember.z) === undefined)
    throw new Error('base-3d area: the ember is outside every room')
  // Touching a wall's face is allowed; overlapping it is not (the same strict test `slide` uses).
  const blocked = area.walls.some(
    (w) =>
      x + HERO_HALF > w.minX && x - HERO_HALF < w.maxX && z + HERO_HALF > w.minZ && z - HERO_HALF < w.maxZ,
  )
  if (blocked) throw new Error('base-3d area: the spawn overlaps a wall')
  return area
}

/** The fields of each definition that name another entity (a list or one id). */
const ENTITY_REFS: Readonly<Partial<Record<EntityDefName, readonly string[]>>> = {
  door: ['switch'],
  switch: ['targets'],
  chest: ['hidden'],
  'sling-target': ['targets'],
  entry: ['portal'],
}
/** The lengths a definition's fields hold, in metres, which compile into Q16.16 metres. */
const LENGTHS = ['x', 'z', 'y', 'width', 'depth', 'height'] as const

/** JSON-path text for Zod's issue path under `entities[index]`. */
const pathOf = (index: number, path: readonly PropertyKey[]): string =>
  path.reduce<string>(
    (text, key) => (typeof key === 'number' ? `${text}[${key}]` : `${text}.${String(key)}`),
    `entities[${index}]`,
  )

/**
 * Checks every entity against its definition, its id against the others, and every reference against the entities
 * there are, then compiles the lengths into fixed point. Throws `AreaLoadError` at the first fault.
 */
function compileEntities(area: string, sources: readonly EntitySource[]): AreaEntity[] {
  const parsed = sources.map((source, index) => {
    if (!Object.hasOwn(ENTITY_DEFS, source.def))
      throw new AreaLoadError(area, `entities[${index}].def`, `there is no definition "${source.def}"`)
    const def = source.def as EntityDefName
    const result = ENTITY_DEFS[def].safeParse(source)
    if (!result.success) {
      const [issue] = result.error.issues
      throw new AreaLoadError(area, pathOf(index, issue?.path ?? []), issue?.message ?? 'invalid')
    }
    return { ...(result.data as Record<string, unknown>), def } as Record<string, unknown> & {
      def: EntityDefName
      id: string
    }
  })
  const ids = new Map<string, string>()
  parsed.forEach((entity, index) => {
    if (ids.has(entity.id))
      throw new AreaLoadError(area, `entities[${index}].id`, `the id "${entity.id}" is used twice`)
    ids.set(entity.id, entity.def)
  })
  parsed.forEach((entity, index) => {
    for (const field of ENTITY_REFS[entity.def] ?? []) {
      const value = entity[field]
      const named = value === undefined ? [] : Array.isArray(value) ? (value as string[]) : [value as string]
      named.forEach((id, at) => {
        const path = Array.isArray(value)
          ? `entities[${index}].${field}[${at}]`
          : `entities[${index}].${field}`
        if (!ids.has(id)) throw new AreaLoadError(area, path, `no entity has the id "${id}"`)
      })
    }
    // A switch door names a switch, and must name one.
    if (entity.def === 'door' && entity.lock === 'switch') {
      const named = entity.switch as string | undefined
      if (named === undefined)
        throw new AreaLoadError(area, `entities[${index}].switch`, 'a switch door names its switch')
      if (ids.get(named) !== 'switch')
        throw new AreaLoadError(area, `entities[${index}].switch`, `"${named}" is not a switch`)
    }
  })
  return parsed.map((entity) => {
    // A field given as `undefined` is left out: the content is hashed as canonical JSON, which has no undefined.
    const compiled: Record<string, unknown> = {}
    for (const [field, value] of sortedEntries(entity)) if (value !== undefined) compiled[field] = value
    for (const field of LENGTHS)
      if (typeof entity[field] === 'number') compiled[field] = metres(entity[field] as number)
    return compiled as unknown as AreaEntity
  })
}

/**
 * Compiles each area (`compileArea`) into the world, the first being where a new game starts. Throws on an empty
 * list, a repeated id, and an exit naming an unknown area or arriving outside its rooms.
 */
export function compileWorld(
  sources: readonly AreaSource[],
  moves: readonly MoveDef[] = [...HERO_MOVES, ...ENEMY_MOVES, ...ITEM_MOVES],
): World {
  const areas = sources.map(compileArea)
  if (areas.length === 0) throw new Error('base-3d world: there are no areas')
  areas.forEach((area, index) => {
    if (areas.findIndex((other) => other.id === area.id) !== index)
      throw new Error(`base-3d world: the area "${area.id}" is defined twice`)
  })
  for (const area of areas)
    for (const exit of area.exits) {
      const to = areas.find((other) => other.id === exit.to)
      if (to === undefined)
        throw new Error(`base-3d world: an exit of "${area.id}" names the unknown area "${exit.to}"`)
      if (viewAt(to, exit.entry.x, exit.entry.z) === undefined)
        throw new Error(
          `base-3d world: an exit of "${area.id}" has its entry outside every room of "${to.id}"`,
        )
    }
  moves.forEach((move, index) => {
    if (moves.findIndex((other) => other.id === move.id) !== index)
      throw new Error(`base-3d world: the move "${move.id}" is defined twice`)
    if (move.next !== undefined && !moves.some((other) => other.id === move.next))
      throw new Error(`base-3d world: the move "${move.id}" chains into the unknown move "${move.next}"`)
  })
  return { areas, moves }
}

/** The sim's content as a world of areas, each checked as `areaOf` does. */
export function worldOf(content: unknown): World {
  const world = content as Partial<World> | null
  if (
    world === null ||
    typeof world !== 'object' ||
    !Array.isArray(world.areas) ||
    world.areas.length === 0 ||
    !Array.isArray(world.moves)
  )
    throw new Error('base-3d: the sim content is not a world')
  for (const area of world.areas) areaOf(area)
  return world as World
}

/** The area Wick is in: `place.area` of the sim's world. */
export function areaIn(content: unknown, place: { readonly area: number }): Area {
  const area = worldOf(content).areas[place.area]
  if (area === undefined) throw new Error(`base-3d: the world has no area ${place.area}`)
  return area
}

/**
 * The sim's content as an area. `compileArea` checked its fields before the sim was made; this only checks the
 * shape, every tick, so content that is not an area fails at once instead of deep inside a system.
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
    !Array.isArray(area.targets) ||
    typeof area.ember?.x !== 'number' ||
    typeof area.ember.z !== 'number' ||
    !Array.isArray(area.exits) ||
    !Array.isArray(area.pits)
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
 * Wick, a square of half-size `half` at `x`, `z`, moved by `dx` then `dz` against the area's walls, one axis at a
 * time. A move that would cross a wall's face stops flush against it; a wall he already overlaps does not push
 * him. The test is on crossing the face from outside, not on landing inside, so a move of any length stops at the
 * first face it meets and never passes through a wall, however thin.
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
