// The ember taken by a pickup beside it.
import { defineSystem, type SystemDef } from '@mcthaydt/automata-sim'
import { Hero, HeroAction } from '../components.ts'
import { ACTION_CLIP, EMBER_REACH } from '../constants.ts'
import { EmberTaken } from '../events.ts'
import { Location, Progress } from '../resources.ts'
import { areaIn } from './area.ts'

/**
 * Takes the ember: on the tick a pickup starts (`heroAct` stamps `startedAt` with it), within `EMBER_REACH` of the
 * ember in both axes, counts it in `Progress` and emits `ember.taken`.
 */
export const emberTake: SystemDef = defineSystem({
  name: 'ember.take',
  phase: 'prePhysics',
  after: ['hero.act'],
  run(ctx) {
    const { ember } = areaIn(ctx.content, ctx.resource(Location))
    for (const entity of ctx.query(Hero, HeroAction)) {
      const { clip, startedAt } = entity.get(HeroAction)
      if (clip !== ACTION_CLIP.pickup || startedAt !== ctx.tick) continue
      const { x, z } = entity.get(Hero)
      if (Math.abs(x - ember.x) > EMBER_REACH || Math.abs(z - ember.z) > EMBER_REACH) continue
      ctx.resource(Progress).embers += 1
      ctx.emit(EmberTaken, { x: ember.x, z: ember.z })
    }
  },
})
