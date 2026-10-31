// The dungeon pieces in the sim (DESIGN.md §10, GAME-3D.1f): spawned from the area's entities, opened, and saved by
// id in the `Dungeon` resource. Part 1: the sling targets. Part 2: doors and keys, and the rooms visited. Part 3:
// switches, blocks, and what resets on room entry. Sim code.
import { defineSystem, type SimContext, type SpawnPart, type SystemDef } from '@mcthaydt/automata-sim'
import { Block, Door, Enemy, Fighter, Hero, HeroControl, SlingTarget, Switch, Target } from '../components.ts'
import {
  ACTION_BITS,
  BLOCK_CELL,
  BLOCK_CONTACT,
  BLOCK_PUSH_TICKS,
  HERO_HALF,
  SLING_TARGET,
} from '../constants/index.ts'
import { BlockMoved, DoorOpened, SwitchChanged } from '../events.ts'
import { Dungeon, Freeze, Location } from '../resources.ts'
import { type Area, type AreaEntity, areaIn, type PlanBox } from './area.ts'
import { facingVector } from './combat-geometry.ts'
import { addFlag, boxOf, flagOf, heroBox, inReach, inside, overlaps } from './dungeon-common.ts'
import { pieceParts, resetPots } from './dungeon-pieces.ts'
import { blockBox, wallsOf } from './walls.ts'

/**
 * The pieces an area starts with: each `sling-target` as a lockable target whose hurt cylinder is centred on its
 * height (§9.2's aim rises to a candidate's middle), on the foes' side so a pellet lands on it; and each `door`,
 * closed until `dungeon.doors` finds it saved open; and part 4's (`pieceParts`). `spawnFoes` adds them to what an area
 * spawns.
 */
export function spawnPieces(area: Area): SpawnPart[][] {
  return area.entities.flatMap((entity, index): SpawnPart[][] => {
    if (entity.def === 'sling-target') {
      const height = entity.height as number
      return [
        [
          [Target, { x: entity.x, z: entity.z, facing: 0 }],
          [Fighter, { side: 1, ...SLING_TARGET, lift: height - Math.trunc(SLING_TARGET.height / 2) }],
          [SlingTarget, { piece: index + 1 }],
        ],
      ]
    }
    if (entity.def === 'door') return [[[Door, { piece: index + 1, open: false, ...boxOf(entity) }]]]
    if (entity.def === 'switch') return [[[Switch, { piece: index + 1, on: false, ...boxOf(entity) }]]]
    if (entity.def === 'block')
      return [
        [[Block, { piece: index + 1, x: entity.x, z: entity.z, homeX: entity.x, homeZ: entity.z, push: 0 }]],
      ]
    return pieceParts(entity, index)
  })
}

/** Whether any living foe stands in a room that holds the door's centre (a `clear` door's rule). */
function foeNear(ctx: SimContext, area: Area, door: AreaEntity): boolean {
  const rooms = area.rooms.filter((room) => inside(room, door.x, door.z))
  return ctx.query(Enemy, Fighter, Target).some((foe) => {
    if (foe.get(Fighter).health <= 0) return false
    const { x, z } = foe.get(Target)
    return rooms.some((room) => inside(room, x, z))
  })
}

/** A switch entity as `setSwitch` reads and writes it. */
interface SwitchRef {
  get(component: typeof Switch): { readonly piece: number; readonly on: boolean }
  set(component: typeof Switch, values: { on: boolean }): void
}

/** Turns a switch on or off: announced when it changes; a latching switch turned on is saved and never goes off. */
function setSwitch(ctx: SimContext, area: Area, entity: SwitchRef, on: boolean): void {
  const { piece, on: was } = entity.get(Switch)
  const def = area.entities[piece - 1]
  if (def === undefined) return
  const flag = flagOf(area, def)
  const dungeon = ctx.resource(Dungeon)
  if (!on && def.latch === true && dungeon.flags.includes(flag)) return
  if (on && def.latch === true) addFlag(dungeon.flags, flag)
  if (on === was) return
  entity.set(Switch, { on })
  ctx.emit(SwitchChanged, { piece, on })
}

/**
 * A pellet hit the sling target `piece` (combat's rule): each eye switch it names goes on (DESIGN.md §10: an eye is
 * hit by a pellet).
 */
export function slingTargetHit(ctx: SimContext, piece: number): void {
  const area = areaIn(ctx.content, ctx.resource(Location))
  const targets = (area.entities[piece - 1]?.targets as readonly string[] | undefined) ?? []
  for (const entity of ctx.query(Switch)) {
    const def = area.entities[entity.get(Switch).piece - 1]
    if (def?.kind === 'eye' && targets.includes(def.id)) setSwitch(ctx, area, entity, true)
  }
}

/**
 * The switches (DESIGN.md §10): a latching one saved on is on; a plate is on while a block's centre stands on it, or
 * Wick does when it latches; a lever goes on with a pick-up press beside it. An eye goes on from a pellet
 * (`slingTargetHit`). Runs before the doors, which follow their switches.
 */
export const dungeonSwitches: SystemDef = defineSystem({
  name: 'dungeon.switches',
  phase: 'prePhysics',
  after: ['hero.act'],
  before: ['dungeon.doors'],
  run(ctx) {
    if (ctx.resource(Freeze).active) return
    const area = areaIn(ctx.content, ctx.resource(Location))
    const dungeon = ctx.resource(Dungeon)
    const wick = ctx.query(Hero, HeroControl)[0]
    const pressed = wick !== undefined && (wick.get(HeroControl).actPressed & ACTION_BITS.pickup) !== 0
    const { x, z } = wick?.get(Hero) ?? { x: 0, z: 0 }
    const blocks = ctx.query(Block).map((entity) => entity.get(Block))
    for (const entity of ctx.query(Switch)) {
      const box = entity.get(Switch)
      const def = area.entities[box.piece - 1]
      if (def === undefined) continue
      if (def.latch === true && dungeon.flags.includes(flagOf(area, def))) {
        setSwitch(ctx, area, entity, true)
        continue
      }
      if (def.kind === 'plate') {
        const held = blocks.some((block) => inside(box, block.x, block.z))
        setSwitch(ctx, area, entity, held || (def.latch === true && inside(box, x, z)))
      } else if (def.kind === 'lever' && pressed && inReach(box, x, z)) setSwitch(ctx, area, entity, true)
    }
  },
})

/**
 * Opens doors (DESIGN.md §10): a door saved open opens at once; a `clear` door when no living foe stands in its
 * rooms; and on a pick-up press with Wick beside it, a `none` door, a `small-key` door with a key in hand (spent) or
 * the boss door with the boss key (spent). An opened door is saved and announced. A `switch` door is open while its
 * switch is on. Runs before Wick moves, so a door opened this tick lets him through.
 */
export const dungeonDoors: SystemDef = defineSystem({
  name: 'dungeon.doors',
  phase: 'prePhysics',
  after: ['hero.act'],
  run(ctx) {
    if (ctx.resource(Freeze).active) return
    const area = areaIn(ctx.content, ctx.resource(Location))
    const dungeon = ctx.resource(Dungeon)
    const wick = ctx.query(Hero, HeroControl)[0]
    const pressed = wick !== undefined && (wick.get(HeroControl).actPressed & ACTION_BITS.pickup) !== 0
    const { x, z } = wick?.get(Hero) ?? { x: 0, z: 0 }
    const switches = ctx.query(Switch).map((entity) => entity.get(Switch))
    for (const entity of ctx.query(Door)) {
      const door = entity.get(Door)
      const piece = area.entities[door.piece - 1]
      if (piece === undefined) continue
      // A switch door is open exactly while its switch is on (§10); its switch, not the door, is what is saved.
      if (piece.lock === 'switch') {
        const named = area.entities.findIndex((other) => other.id === piece.switch) + 1
        const on = switches.some((sw) => sw.piece === named && sw.on)
        if (on !== door.open) {
          entity.set(Door, { open: on })
          if (on) ctx.emit(DoorOpened, { piece: door.piece })
        }
        continue
      }
      if (door.open) continue
      const flag = flagOf(area, piece)
      let opens = dungeon.flags.includes(flag)
      if (!opens && piece.lock === 'clear') opens = !foeNear(ctx, area, piece)
      if (!opens && pressed && inReach(door, x, z)) {
        if (piece.lock === 'none') opens = true
        else if (piece.lock === 'small-key' && dungeon.smallKeys > 0) {
          dungeon.smallKeys -= 1
          opens = true
        } else if (piece.lock === 'boss-key' && dungeon.bossKey) {
          dungeon.bossKey = false
          opens = true
        }
      }
      if (!opens) continue
      entity.set(Door, { open: true })
      if (!dungeon.flags.includes(flag)) {
        addFlag(dungeon.flags, flag)
        ctx.emit(DoorOpened, { piece: door.piece })
      }
    }
  },
})

/**
 * Pushes blocks (DESIGN.md §10): while Wick holds pick up and the stick, flush against a block's face on the axis he
 * faces most and facing it, the push counts; at `BLOCK_PUSH_TICKS` the block moves one cell that way unless the cell
 * holds a wall, a closed door, another block, a pit or Wick (G3-F6). Letting go, or turning away, starts the count
 * again. Runs after Wick moves, so the contact is this tick's.
 */
export const dungeonBlocks: SystemDef = defineSystem({
  name: 'dungeon.blocks',
  phase: 'physics',
  after: ['hero.move'],
  run(ctx) {
    if (ctx.resource(Freeze).active) return
    const wick = ctx.query(Hero, HeroControl)[0]
    if (wick === undefined) return
    const hero = wick.get(Hero)
    const control = wick.get(HeroControl)
    const pushing =
      (control.actHeld & ACTION_BITS.pickup) !== 0 && (control.stickX !== 0 || control.stickY !== 0)
    const forward = facingVector(hero.facing)
    const alongX = Math.abs(forward.x) > Math.abs(forward.z)
    const dx = alongX ? Math.sign(forward.x) * BLOCK_CELL : 0
    const dz = alongX ? 0 : Math.sign(forward.z) * BLOCK_CELL
    const area = areaIn(ctx.content, ctx.resource(Location))
    for (const entity of ctx.query(Block)) {
      const block = entity.get(Block)
      const box = blockBox(block.x, block.z)
      const half = Math.trunc(BLOCK_CELL / 2)
      // Flush against the face Wick looks at, and square to it.
      const gap = alongX
        ? dx > 0
          ? box.minX - (hero.x + HERO_HALF)
          : hero.x - HERO_HALF - box.maxX
        : dz > 0
          ? box.minZ - (hero.z + HERO_HALF)
          : hero.z - HERO_HALF - box.maxZ
      const square = alongX ? Math.abs(hero.z - block.z) < half : Math.abs(hero.x - block.x) < half
      if (!pushing || gap < 0 || gap > BLOCK_CONTACT || !square) {
        if (block.push !== 0) entity.set(Block, { push: 0 })
        continue
      }
      if (block.push + 1 < BLOCK_PUSH_TICKS) {
        entity.set(Block, { push: block.push + 1 })
        continue
      }
      const to = blockBox(block.x + dx, block.z + dz)
      const others = wallsOf(ctx).filter(
        (wall) =>
          wall.minX !== box.minX ||
          wall.minZ !== box.minZ ||
          wall.maxX !== box.maxX ||
          wall.maxZ !== box.maxZ,
      )
      const blocked =
        others.some((wall) => overlaps(wall, to)) ||
        area.pits.some((pit) => overlaps(pit, to)) ||
        overlaps(heroBox(hero.x, hero.z), to)
      if (blocked) {
        entity.set(Block, { push: 0 })
        continue
      }
      entity.set(Block, { x: block.x + dx, z: block.z + dz, push: 0 })
      ctx.emit(BlockMoved, { piece: block.piece, x: block.x + dx, z: block.z + dz })
    }
  },
})

/**
 * Records the room Wick stands in as visited (DESIGN.md §9.4's map), by its view id, sorted; and when he comes into
 * another room, resets its pieces (§10): blocks go home unless they stand on a latched plate, and switches that do not
 * latch go off.
 */
export const dungeonVisit: SystemDef = defineSystem({
  name: 'dungeon.visit',
  phase: 'postPhysics',
  after: ['hero.view'],
  run(ctx) {
    const wick = ctx.query(Hero)[0]
    if (wick === undefined) return
    const { x, z } = wick.get(Hero)
    const area = areaIn(ctx.content, ctx.resource(Location))
    const room = area.rooms.find((box) => inside(box, x, z))
    const dungeon = ctx.resource(Dungeon)
    if (room === undefined || room.view === dungeon.room) return
    const entering = dungeon.room !== ''
    dungeon.room = room.view
    if (!dungeon.visited.includes(room.view)) {
      dungeon.visited.push(room.view)
      dungeon.visited.sort()
    }
    if (entering) resetRoom(ctx, area, room)
  },
})

/** What resets as Wick comes into `room` (§10): its blocks, its switches that do not latch, and its pots. */
function resetRoom(ctx: SimContext, area: Area, room: PlanBox): void {
  const switches = ctx.query(Switch)
  const latchedPlates = switches
    .map((entity) => entity.get(Switch))
    .filter((box) => {
      const def = area.entities[box.piece - 1]
      return def?.kind === 'plate' && def.latch === true && box.on
    })
  for (const entity of ctx.query(Block)) {
    const block = entity.get(Block)
    if (!inside(room, block.homeX, block.homeZ)) continue
    if (latchedPlates.some((plate) => inside(plate, block.x, block.z))) continue
    if (block.x !== block.homeX || block.z !== block.homeZ)
      entity.set(Block, { x: block.homeX, z: block.homeZ, push: 0 })
  }
  for (const entity of switches) {
    const box = entity.get(Switch)
    const def = area.entities[box.piece - 1]
    if (def?.latch !== true && inside(room, def?.x ?? 0, def?.z ?? 0)) setSwitch(ctx, area, entity, false)
  }
  resetPots(ctx, area, room)
}
