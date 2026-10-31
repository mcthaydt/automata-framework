// The ember taken by a pickup beside it.
import { defineSystem, type SystemDef } from '@mcthaydt/automata-sim'
import { Hero, HeroAction } from '../components.ts'
import { ACTION_CLIP, EMBER_REACH } from '../constants.ts'
import { EmberTaken } from '../events.ts'
import { areaOf } from './area.ts'

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
