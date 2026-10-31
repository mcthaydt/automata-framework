// base-3d's systems and their order (DESIGN.md §3.1). Sim code: `pnpm boundaries` checks every file in src/.
// A tick runs: the camera's turn (render-pixi3d, input), the stick and lock copied onto Wick (input), the lock
// target held or chosen, the action buttons' presses, the ember taken by a pickup beside it (prePhysics), Wick moved through the heading (physics), the room's view entered
// (postPhysics).
import {
  CameraHeading,
  type CameraView,
  cameraViewSchema,
  enterView,
  moveDirection,
  Q16,
  TURN_UNITS,
  wrapHeading,
} from '@mcthaydt/automata-render-pixi3d/sim'
import { defineSystem, type SystemDef } from '@mcthaydt/automata-sim'
import { atan2 } from '@mcthaydt/automata-sim/math'
import { z } from 'zod'
import { Act, Lock, Move } from './commands.ts'
import { Hero, HeroAction, HeroControl, Target } from './components.ts'
import {
  ACTION_BITS,
  ACTION_CLIP,
  ACTION_TICKS,
  EMBER_REACH,
  HERO_HALF,
  LOCK_RANGE,
  metres,
  WALK_PER_TICK,
} from './constants.ts'
import { EmberTaken } from './events.ts'

// --- the area: the level content compiled to fixed point, and the geometry the systems read ---

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
  readonly ember: PlanPoint
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
  const area: Area = {
    spawn: toPoint(parsed.spawn),
    views,
    rooms: parsed.rooms.map((room) => ({ view: room.view, ...toBox(room) })),
    walls: parsed.walls.map(toBox),
    targets: parsed.targets.map(toPoint),
    ember: toPoint(parsed.ember),
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
    typeof area.ember.z !== 'number'
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

// --- the systems ---

// 2π spelled out: `Math.PI` is not sim-safe.
const TAU = 6.283185307179586
const HALF_TURN = TURN_UNITS / 2

/** The turn-unit angle of the plan direction `x`, `z` (0 toward +z, growing toward +x), rounded to a unit. */
const angleOf = (x: number, z: number): number => wrapHeading((atan2(x, z) * TURN_UNITS) / TAU)

/** `units` as the nearest signed angle, −32,768..32,767. */
const signedTurn = (units: number): number => wrapHeading(units + HALF_TURN) - HALF_TURN

/**
 * Copies this tick's stick, lock and action buttons onto Wick, and marks the tick each went down. No command is a
 * centred stick and every button up.
 */
export const heroInput: SystemDef = defineSystem({
  name: 'hero.input',
  phase: 'input',
  run(ctx) {
    const moves = ctx.commands.of(Move)
    const locks = ctx.commands.of(Lock)
    const stick = moves[moves.length - 1]?.payload ?? { x: 0, y: 0 }
    const lockHeld = locks[locks.length - 1]?.payload.down ?? false
    const acts = ctx.commands.of(Act)
    const act = acts[acts.length - 1]?.payload
    let actHeld = 0
    if (act?.slash === true) actHeld |= ACTION_BITS.slash
    if (act?.guard === true) actHeld |= ACTION_BITS.guard
    if (act?.point === true) actHeld |= ACTION_BITS.point
    if (act?.pickup === true) actHeld |= ACTION_BITS.pickup
    for (const entity of ctx.query(HeroControl)) {
      const before = entity.get(HeroControl)
      const lockPressed = lockHeld && !before.lockHeld
      const actPressed = actHeld & ~before.actHeld
      entity.set(HeroControl, {
        stickX: stick.x,
        stickY: stick.y,
        lockHeld,
        lockPressed,
        actHeld,
        actPressed,
      })
    }
  },
})

/**
 * Holds Wick's lock: on the press (DESIGN.md §11.1), the nearest target within `LOCK_RANGE` in plan (squared
 * distances in Q16.16, exact below 2^53; a tie goes to the lower entity id), or none. Holding keeps that result,
 * so walking into range while held does not lock; a release clears it. The selection cone, cycling and the heading
 * assist are GAME-3D.1b's (DESIGN.md §11).
 */
export const lockSelect: SystemDef = defineSystem({
  name: 'lock.select',
  phase: 'prePhysics',
  run(ctx) {
    for (const entity of ctx.query(Hero, HeroControl)) {
      const hero = entity.get(Hero)
      const control = entity.get(HeroControl)
      if (!control.lockHeld) {
        if (hero.lockTarget !== 0) entity.set(Hero, { lockTarget: 0 })
        continue
      }
      if (!control.lockPressed) {
        // A target that is gone lets go of the lock, as a release does.
        if (hero.lockTarget !== 0 && ctx.entity(hero.lockTarget)?.has(Target) !== true)
          entity.set(Hero, { lockTarget: 0 })
        continue
      }
      let best = 0
      let bestDistance = LOCK_RANGE * LOCK_RANGE
      // Ascending entity ids, and only a strictly nearer target replaces the best: a tie keeps the lower id.
      for (const target of ctx.query(Target)) {
        const { x, z } = target.get(Target)
        const distance = (x - hero.x) * (x - hero.x) + (z - hero.z) * (z - hero.z)
        if (distance < bestDistance || (best === 0 && distance === bestDistance)) {
          best = target.sid
          bestDistance = distance
        }
      }
      entity.set(Hero, { lockTarget: best })
    }
  },
})

/**
 * Moves Wick through the camera's heading (or the latched one, M3R-D15) at the walk speed scaled by the stick's
 * push. He faces the way he travels; standing, he keeps his facing; locked, he faces the target from where the tick
 * found him, and `moveDir` is his travel relative to that. Walls stop him (`slide`).
 */
export const heroMove: SystemDef = defineSystem({
  name: 'hero.move',
  phase: 'physics',
  run(ctx) {
    const { walls } = areaOf(ctx.content)
    for (const entity of ctx.query(Hero, HeroControl, CameraHeading)) {
      const control = entity.get(HeroControl)
      const hero = entity.get(Hero)
      const mapped = moveDirection(entity.get(CameraHeading), { x: control.stickX, y: control.stickY })
      entity.set(CameraHeading, mapped.state)
      const { direction } = mapped
      const moving = direction.x !== 0 || direction.z !== 0
      // Exact: both factors are integers under 2^17, so the product is exact and the division by 2^16 too.
      const dx = Math.trunc((direction.x * WALK_PER_TICK) / Q16)
      const dz = Math.trunc((direction.z * WALK_PER_TICK) / Q16)
      const { x, z } = slide(walls, HERO_HALF, hero, dx, dz)
      const target = hero.lockTarget === 0 ? undefined : ctx.entity(hero.lockTarget)?.get(Target)
      const travel = angleOf(direction.x, direction.z)
      // A target exactly where he stands has no direction (atan2(0, 0)): he keeps his facing.
      const toTarget =
        target === undefined || (target.x === hero.x && target.z === hero.z)
          ? undefined
          : angleOf(target.x - hero.x, target.z - hero.z)
      const facing = target !== undefined ? (toTarget ?? hero.facing) : moving ? travel : hero.facing
      const moveDir = moving ? signedTurn(travel - facing) : 0
      entity.set(Hero, { x, z, facing, moving, moveDir })
    }
  },
})

/**
 * Puts Wick's camera in the view of the room he stands in. Entering another view takes its heading at once and,
 * with the stick held, latches the mapping to the old heading (`enterView`, M3R-D15); the next tick's move reads it.
 */
export const heroView: SystemDef = defineSystem({
  name: 'hero.view',
  phase: 'postPhysics',
  run(ctx) {
    const area = areaOf(ctx.content)
    for (const entity of ctx.query(Hero, HeroControl, CameraHeading)) {
      const { x, z } = entity.get(Hero)
      const view = viewAt(area, x, z)
      const heading = entity.get(CameraHeading)
      if (view === undefined || view.id === heading.view) continue
      const control = entity.get(HeroControl)
      entity.set(CameraHeading, enterView(heading, view, { x: control.stickX, y: control.stickY }))
    }
  },
})

/**
 * Starts and ends Wick's actions (M3 spec §4.7): a slash press starts a slash at this tick, replacing any action
 * running (a second slash mid-swing; the view blends the two, M3R-D16); a point or pickup press starts only when
 * nothing runs. An action ends `ACTION_TICKS` after it started. Guard is a stance held while its button is.
 */
export const heroAct: SystemDef = defineSystem({
  name: 'hero.act',
  phase: 'prePhysics',
  run(ctx) {
    for (const entity of ctx.query(HeroAction, HeroControl)) {
      const { actHeld, actPressed } = entity.get(HeroControl)
      const before = entity.get(HeroAction)
      let { clip, startedAt } = before
      if (clip === ACTION_CLIP.slash && ctx.tick - startedAt >= ACTION_TICKS.slash) clip = 0
      if (clip === ACTION_CLIP.point && ctx.tick - startedAt >= ACTION_TICKS.point) clip = 0
      if (clip === ACTION_CLIP.pickup && ctx.tick - startedAt >= ACTION_TICKS.pickup) clip = 0
      if ((actPressed & ACTION_BITS.slash) !== 0) {
        clip = ACTION_CLIP.slash
        startedAt = ctx.tick
      } else if (clip === 0 && (actPressed & ACTION_BITS.point) !== 0) {
        clip = ACTION_CLIP.point
        startedAt = ctx.tick
      } else if (clip === 0 && (actPressed & ACTION_BITS.pickup) !== 0) {
        clip = ACTION_CLIP.pickup
        startedAt = ctx.tick
      }
      const guard = (actHeld & ACTION_BITS.guard) !== 0
      const guardSince = guard && !before.guard ? ctx.tick : before.guardSince
      entity.set(HeroAction, { clip, startedAt, guard, guardSince })
    }
  },
})

/**
 * Takes the ember: on the tick a pickup starts (`heroAct` stamps `startedAt` with it), within `EMBER_REACH` of the
 * ember in both axes, emits `ember.taken`. It keeps no state, because the play screen leaves on the first one.
 */
export const emberTake: SystemDef = defineSystem({
  name: 'ember.take',
  phase: 'prePhysics',
  after: ['hero.act'],
  run(ctx) {
    const { ember } = areaOf(ctx.content)
    for (const entity of ctx.query(Hero, HeroAction)) {
      const { clip, startedAt } = entity.get(HeroAction)
      if (clip !== ACTION_CLIP.pickup || startedAt !== ctx.tick) continue
      const { x, z } = entity.get(Hero)
      if (Math.abs(x - ember.x) <= EMBER_REACH && Math.abs(z - ember.z) <= EMBER_REACH)
        ctx.emit(EmberTaken, { x: ember.x, z: ember.z })
    }
  },
})
