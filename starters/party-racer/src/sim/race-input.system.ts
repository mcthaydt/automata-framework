import { defineSystem, type EntityRef, type SystemDef } from '@mcthaydt/automata-sim'
import { RaceInput, RaceReset } from './race.command'
import { Race } from './race.resource'
import { HeldInput, Racer } from './racer.component'

// A seat's commands reach its racer (FloorFifty's `applyInputs`, the part that reads the frame). `race.input` replaces
// the held input; `race.reset` marks one respawn, resolved after this tick's contacts. A command from a seat with no
// racer, or outside a running race, changes nothing.

function racerOf(racers: readonly EntityRef[], seat: number): EntityRef | undefined {
  return racers.find((racer) => racer.get(Racer).seat === seat)
}

export const raceInputSystem: SystemDef = defineSystem({
  name: 'party-racer.input',
  phase: 'input',
  after: ['party-racer.start'],
  run(ctx) {
    if (ctx.resource(Race).phase !== 'racing') return
    const racers = ctx.query(Racer, HeldInput)
    for (const { source, payload } of ctx.commands.of(RaceInput))
      racerOf(racers, source)?.set(HeldInput, payload)
    for (const { source } of ctx.commands.of(RaceReset))
      racerOf(racers, source)?.set(Racer, { resetRequested: true })
  },
})
