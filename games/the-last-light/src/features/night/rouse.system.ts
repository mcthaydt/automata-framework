import { defineSystem, type SimContext, type SystemDef } from '@automata/sim'
import { SystemsMode, SystemsState } from '@automata/systems/sim'
import { Night } from './night.resource.ts'

/**
 * When the lights-out cutscene is over, she steps out of the far end of the corridor: patrolling, with a moment's pause. The
 * creature does nothing while a cutscene plays, as the old game ran no rules in one.
 */
export const rouse = (playing: (ctx: SimContext) => boolean): SystemDef =>
  defineSystem({
    name: 'night.rouse',
    phase: 'gameplay',
    before: ['systems.step'],
    run: (ctx) => {
      const night = ctx.resource(Night)
      if (!night.waking || playing(ctx)) return
      night.waking = false
      const figure = ctx.resource(SystemsState).agents.nurse
      if (figure === undefined) return
      ctx.emit(SystemsMode, { agent: 'nurse', from: figure.mode, to: 'patrol' })
      Object.assign(figure, { mode: 'patrol', patrol: 0, path: [], goal: null, timer: 1.5 })
    },
  })
