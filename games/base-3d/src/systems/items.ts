// The items (DESIGN.md §9.1, GAME-3D.1e): the Spark Sling's draw and its pellets' flight. A pellet is a fighter on
// Wick's side playing `sling-pellet` on every tick it flies, so `combat.hits` lands it as any hit. Sim code:
// `pnpm boundaries` checks it.
import { CameraHeading } from '@mcthaydt/automata-render-pixi3d/sim'
import { defineSystem, type SystemDef } from '@mcthaydt/automata-sim'
import { Bomb, Chain, Enemy, Fighter, Hero, HeroControl, Pellet, Target } from '../components.ts'
import { enemyOf } from '../constants/enemies.ts'
import { ACTION_BITS, CombatState } from '../constants/index.ts'
import { BOMBS, CHEST_HEIGHT, HOOKCHAIN, ItemCode, SLING } from '../constants/items.ts'
import { BombBlast, ChainHooked, ShotFired } from '../events.ts'
import { Inventory, Location } from '../resources.ts'
import { aimDirection, pickTarget } from './aim.ts'
import { areaIn, worldOf } from './area.ts'
import { frozen } from './combat.ts'
import { facingVector, reachHits } from './combat-geometry.ts'
import { angleOf, lineOfSight } from './lock-target.ts'

/** `step` Q16.16 metres along `facing` (turn units), truncated. */
function ahead(facing: number, step: number): { dx: number; dz: number } {
  const direction = facingVector(facing)
  return { dx: Math.trunc((direction.x * step) / 4096), dz: Math.trunc((direction.z * step) / 4096) }
}

/**
 * The Item button (§9.1, §9.2): with the sling owned, equipped and loaded, holding Item draws; letting go after
 * `SLING.draw` ticks or more fires a pellet along the aim (the locked target, else the stick, else the facing), or
 * at the foe it picks near that line, at that foe's height, and spends one. Wick turns the way it flies. A shorter draw fires nothing.
 */
export const itemUse: SystemDef = defineSystem({
  name: 'item.use',
  phase: 'prePhysics',
  after: ['hero.act'],
  run(ctx) {
    if (frozen(ctx)) return
    const inventory = ctx.resource(Inventory)
    const [wick] = ctx.query(Hero, HeroControl, CameraHeading)
    if (wick === undefined) return
    const control = wick.get(HeroControl)
    // A press with bombs owned, equipped and in stock places one at his feet (§9.1).
    const placing = inventory.bombs && inventory.equipped === ItemCode.bombs && inventory.bombAmmo > 0
    if (placing && (control.actPressed & ACTION_BITS.item) !== 0) {
      const { x, z } = wick.get(Hero)
      ctx.spawn([Bomb, { x, z, fuse: BOMBS.fuse }], [Fighter, { side: 2, health: 1, radius: 0, height: 0 }])
      inventory.bombAmmo -= 1
    }
    const sling = inventory.sling && inventory.equipped === ItemCode.sling && inventory.pellets > 0
    // The hookchain throws one chain at a time (§9.1).
    const hook =
      inventory.hookchain && inventory.equipped === ItemCode.hookchain && ctx.query(Chain).length === 0
    if ((control.actHeld & ACTION_BITS.item) !== 0) {
      if (sling || hook) inventory.draw += 1
      return
    }
    const held = inventory.draw
    inventory.draw = 0
    const fires = sling && held >= SLING.draw
    const throws = hook && held > 0
    if (!fires && !throws) return
    const hero = wick.get(Hero)
    const locked = hero.lockTarget === 0 ? undefined : ctx.entity(hero.lockTarget)?.get(Target)
    const stick = { x: control.stickX, y: control.stickY }
    const aim = aimDirection(hero, locked, stick, wick.get(CameraHeading).heading)
    const foes = ctx
      .query(Fighter, Target)
      .filter((entity) => entity.get(Fighter).side === 1 && entity.get(Fighter).health > 0)
      .map((entity) => ({ id: entity.sid, ...entity.get(Target), ...entity.get(Fighter) }))
    // The hookchain's targets are the hook posts too (§9.2), ahead of any foe at the same distance.
    const { posts } = areaIn(ctx.content, ctx.resource(Location))
    const hooks = throws ? posts.map((post, index) => ({ id: -1 - index, ...post, lift: 0, height: 0 })) : []
    const pick = pickTarget(hero, aim, [...hooks, ...foes])
    const facing = pick?.facing ?? aim
    wick.set(Hero, { facing })
    if (throws) {
      ctx.spawn([Chain, { x: hero.x, z: hero.z, facing, travelled: 0, pulling: false, postX: 0, postZ: 0 }])
      ctx.emit(ShotFired, { item: 'hookchain', x: hero.x, z: hero.z })
      return
    }
    ctx.spawn(
      [Pellet, { x: hero.x, z: hero.z, y: pick?.y ?? CHEST_HEIGHT, facing, travelled: 0 }],
      [Fighter, { side: 0, health: 1, radius: 0, height: 0 }],
    )
    inventory.pellets -= 1
    ctx.emit(ShotFired, { item: 'sling', x: hero.x, z: hero.z })
  },
})

/**
 * Counts every bomb's fuse down a live tick (§9.1); a bomb whose fuse has run out plays `bomb-blast` on this tick,
 * for `combat.hits` to land on everyone within its ring, and is gone at the end of the tick.
 */
export const bombFuse: SystemDef = defineSystem({
  name: 'bomb.fuse',
  phase: 'gameplay',
  before: ['combat.hits'],
  run(ctx) {
    if (frozen(ctx)) return
    const move = worldOf(ctx.content).moves.findIndex((candidate) => candidate.id === 'bomb-blast') + 1
    for (const entity of ctx.query(Bomb, Fighter)) {
      const bomb = entity.get(Bomb)
      if (bomb.fuse > 0) {
        entity.set(Bomb, { fuse: bomb.fuse - 1 })
        continue
      }
      entity.set(Fighter, { move, moveTick: 1, moveStart: ctx.tick, state: CombatState.act })
      ctx.emit(BombBlast, { x: bomb.x, z: bomb.z })
      ctx.despawn(entity.sid)
    }
  },
})

/**
 * Flies the Hookchain one tick, or pulls Wick along it (§9.1). Out, a wall across this tick's flight ends it (it
 * returns); a hook post within reach of the flight hooks it; else the first foe the flight meets stops it, and a
 * Sootling or a Wisp is stunned 90 ticks. Hooked, it pulls Wick straight toward the post at 10 m/s until he stands
 * 0.6 m from it, holding his i-frames so no hit lands; the flight already checked that line for walls.
 */
export const chainFly: SystemDef = defineSystem({
  name: 'chain.fly',
  phase: 'physics',
  after: ['hero.move'],
  run(ctx) {
    if (frozen(ctx)) return
    const area = areaIn(ctx.content, ctx.resource(Location))
    const [wick] = ctx.query(Hero, Fighter)
    if (wick === undefined) return
    for (const entity of ctx.query(Chain)) {
      const chain = entity.get(Chain)
      if (chain.pulling) {
        const hero = wick.get(Hero)
        const dx = chain.postX - hero.x
        const dz = chain.postZ - hero.z
        const left = Math.floor(Math.sqrt(dx * dx + dz * dz)) - HOOKCHAIN.stop
        const step = Math.min(HOOKCHAIN.pull, Math.max(0, left))
        const moved = ahead(angleOf(dx, dz), step)
        wick.set(Hero, { x: hero.x + moved.dx, z: hero.z + moved.dz })
        wick.set(Fighter, { iframes: Math.max(wick.get(Fighter).iframes, 2) })
        if (step >= left) ctx.despawn(entity.sid)
        continue
      }
      const from = { x: chain.x, z: chain.z }
      // Its last tick's flight is cut short at the range, so nothing past 8 m is ever reached.
      const step = Math.min(HOOKCHAIN.step, HOOKCHAIN.range - chain.travelled)
      const flight = ahead(chain.facing, step)
      const to = { x: from.x + flight.dx, z: from.z + flight.dz }
      if (!lineOfSight(area.walls, from, to)) {
        ctx.despawn(entity.sid)
        continue
      }
      const forward = facingVector(chain.facing)
      const reach = { near: 0, far: step }
      const post = area.posts.find((candidate) => reachHits(from, forward, reach, candidate, HOOKCHAIN.post))
      if (post !== undefined) {
        entity.set(Chain, { pulling: true, postX: post.x, postZ: post.z })
        ctx.emit(ChainHooked, post)
        continue
      }
      const foe = ctx
        .query(Fighter, Target)
        .find(
          (other) =>
            other.get(Fighter).side === 1 &&
            other.get(Fighter).health > 0 &&
            reachHits(from, forward, reach, other.get(Target), other.get(Fighter).radius),
        )
      if (foe !== undefined) {
        const type = foe.has(Enemy) ? enemyOf(foe.get(Enemy).kind) : undefined
        if (type?.id === 'sootling' || type?.id === 'wisp')
          foe.set(Fighter, {
            state: CombatState.stun,
            stun: HOOKCHAIN.stun,
            move: 0,
            moveTick: 0,
            queued: 0,
            lift: 0,
          })
        ctx.despawn(entity.sid)
        continue
      }
      const travelled = chain.travelled + step
      entity.set(Chain, { ...to, travelled })
      if (travelled >= HOOKCHAIN.range) ctx.despawn(entity.sid)
    }
  },
})

/**
 * Flies every pellet one tick (§9.1): it moves on to where last tick's flight ended, is gone past the sling's range
 * or when a wall stands across this tick's flight, and otherwise plays `sling-pellet` on this tick, reaching one
 * tick's flight ahead, for `combat.hits` to land on the first foe it meets.
 */
export const pelletFly: SystemDef = defineSystem({
  name: 'pellet.fly',
  phase: 'gameplay',
  before: ['combat.hits'],
  run(ctx) {
    if (frozen(ctx)) return
    const moves = worldOf(ctx.content).moves
    const move = moves.findIndex((candidate) => candidate.id === 'sling-pellet') + 1
    const { walls } = areaIn(ctx.content, ctx.resource(Location))
    for (const entity of ctx.query(Pellet, Fighter)) {
      const pellet = entity.get(Pellet)
      let { x, z } = pellet
      if (pellet.travelled > 0) {
        const moved = ahead(pellet.facing, SLING.step)
        x += moved.dx
        z += moved.dz
      }
      const flight = ahead(pellet.facing, SLING.step)
      if (
        pellet.travelled >= SLING.range ||
        !lineOfSight(walls, { x, z }, { x: x + flight.dx, z: z + flight.dz })
      ) {
        ctx.despawn(entity.sid)
        continue
      }
      entity.set(Pellet, { x, z, travelled: pellet.travelled + SLING.step })
      entity.set(Fighter, { move, moveTick: 1, moveStart: ctx.tick, state: CombatState.act })
    }
  },
})
