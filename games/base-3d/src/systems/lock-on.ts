// The lock target held or chosen.
import { defineSystem, type SystemDef } from '@mcthaydt/automata-sim'
import { Hero, HeroControl, Target } from '../components.ts'
import { LOCK_RANGE } from '../constants.ts'

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
