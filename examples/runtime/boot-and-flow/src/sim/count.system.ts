import { defineSystem, type SystemDef } from '@mcthaydt/automata-sim'
import { Tick } from './counter.event.ts'
import { Counter } from './counter.resource.ts'

export const countSystem: SystemDef = defineSystem({
  name: 'count',
  phase: 'gameplay',
  run(ctx) {
    const counter = ctx.resource(Counter)
    counter.count = ctx.tick
    ctx.emit(Tick, { tick: ctx.tick })
  },
})
