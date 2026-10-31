// Drops (DESIGN.md §8.1 rule 6): what a beaten enemy leaves, taken by walking over it. Sim code.
import { defineSystem, type SystemDef } from '@mcthaydt/automata-sim'
import { Drop, Fighter, Hero } from '../components.ts'
import { DROP_REACH, DropKind, HEART_HEAL } from '../constants/enemies.ts'
import { HERO_HEALTH } from '../constants/index.ts'
import { BOMBS, SLING } from '../constants/items.ts'
import { DropTaken } from '../events.ts'
import { Inventory, Progress } from '../resources.ts'
import { frozen } from './combat.ts'

/**
 * Wick's centre within `DROP_REACH` of a drop, each way in plan, takes it after he moved: embers into the run's
 * count, a heart healing 2 half-hearts up to `HERO_HEALTH` (heart pieces raise it with GAME-3D.1e). It is despawned
 * at the end of the tick, and `drop.taken` tells presentation.
 */
export const dropsTake: SystemDef = defineSystem({
  name: 'drops.take',
  phase: 'postPhysics',
  run(ctx) {
    if (frozen(ctx)) return
    const [wick] = ctx.query(Hero, Fighter)
    if (wick === undefined) return
    const { x, z } = wick.get(Hero)
    for (const entity of ctx.query(Drop)) {
      const drop = entity.get(Drop)
      if (Math.abs(drop.x - x) > DROP_REACH || Math.abs(drop.z - z) > DROP_REACH) continue
      const inventory = ctx.resource(Inventory)
      if (drop.kind === DropKind.ember) ctx.resource(Progress).embers += drop.amount
      else if (drop.kind === DropKind.pellets)
        inventory.pellets = Math.min(SLING.maxPellets, inventory.pellets + drop.amount)
      else if (drop.kind === DropKind.bombs)
        inventory.bombAmmo = Math.min(BOMBS.max, inventory.bombAmmo + drop.amount)
      else {
        const { health } = wick.get(Fighter)
        wick.set(Fighter, { health: Math.min(HERO_HEALTH, health + HEART_HEAL * drop.amount) })
      }
      ctx.emit(DropTaken, drop)
      ctx.despawn(entity.sid)
    }
  },
})
