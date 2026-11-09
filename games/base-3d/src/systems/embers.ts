// The embers taken by walking over them, and the goal that ends the run.
import { defineSystem, type SystemDef } from '@automataframework/automata-sim'
import { Ember, Hero } from '../components.ts'
import { EMBER_REACH } from '../constants/index.ts'
import { EmberTaken, GoalReached } from '../events.ts'
import { Progress } from '../resources.ts'

/**
 * Takes each ember within `EMBER_REACH` of Wick in both axes (its index recorded in `Progress.taken`, `ember.taken`, the entity removed);
 * the goal ember also sets `Progress.goal` and emits `goal.reached`.
 */
export const emberTake: SystemDef = defineSystem({
  name: 'ember.take',
  phase: 'postPhysics',
  run(ctx) {
    // An ember a save brought in as taken is already gone: it never shows.
    for (const entity of ctx.query(Ember))
      if (ctx.resource(Progress).taken.includes(entity.get(Ember).index)) ctx.despawn(entity.sid)
    for (const wick of ctx.query(Hero)) {
      const { x, z } = wick.get(Hero)
      for (const entity of ctx.query(Ember)) {
        const ember = entity.get(Ember)
        if (Math.abs(x - ember.x) > EMBER_REACH || Math.abs(z - ember.z) > EMBER_REACH) continue
        const progress = ctx.resource(Progress)
        progress.taken = [...progress.taken, ember.index].sort((a, b) => a - b)
        ctx.emit(EmberTaken, { x: ember.x, z: ember.z })
        if (ember.goal) {
          ctx.resource(Progress).goal = true
          ctx.emit(GoalReached, {})
        }
        ctx.despawn(entity.sid)
      }
    }
  },
})
