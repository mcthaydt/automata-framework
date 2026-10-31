// The items (DESIGN.md §9.1, GAME-3D.1e): the Spark Sling's draw and its pellets' flight. A pellet is a fighter on
// Wick's side playing `sling-pellet` on every tick it flies, so `combat.hits` lands it as any hit. Sim code:
// `pnpm boundaries` checks it.
import { CameraHeading } from '@mcthaydt/automata-render-pixi3d/sim'
import { defineSystem, type SystemDef } from '@mcthaydt/automata-sim'
import { Bomb, Fighter, Hero, HeroControl, Pellet, Target } from '../components.ts'
import { ACTION_BITS, CombatState } from '../constants/index.ts'
import { BOMBS, CHEST_HEIGHT, ItemCode, SLING } from '../constants/items.ts'
import { BombBlast, ShotFired } from '../events.ts'
import { Inventory, Location } from '../resources.ts'
import { aimDirection, pickTarget } from './aim.ts'
import { areaIn, worldOf } from './area.ts'
import { frozen } from './combat.ts'
import { facingVector } from './combat-geometry.ts'
import { lineOfSight } from './lock-target.ts'

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
    const ready = inventory.sling && inventory.equipped === ItemCode.sling && inventory.pellets > 0
    if ((control.actHeld & ACTION_BITS.item) !== 0) {
      if (ready) inventory.draw += 1
      return
    }
    const drawn = inventory.draw >= SLING.draw
    inventory.draw = 0
    if (!drawn || !ready) return
    const hero = wick.get(Hero)
    const locked = hero.lockTarget === 0 ? undefined : ctx.entity(hero.lockTarget)?.get(Target)
    const stick = { x: control.stickX, y: control.stickY }
    const aim = aimDirection(hero, locked, stick, wick.get(CameraHeading).heading)
    const foes = ctx
      .query(Fighter, Target)
      .filter((entity) => entity.get(Fighter).side === 1 && entity.get(Fighter).health > 0)
      .map((entity) => ({ id: entity.sid, ...entity.get(Target), ...entity.get(Fighter) }))
    const pick = pickTarget(hero, aim, foes)
    const facing = pick?.facing ?? aim
    ctx.spawn(
      [Pellet, { x: hero.x, z: hero.z, y: pick?.y ?? CHEST_HEIGHT, facing, travelled: 0 }],
      [Fighter, { side: 0, health: 1, radius: 0, height: 0 }],
    )
    inventory.pellets -= 1
    wick.set(Hero, { facing })
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
