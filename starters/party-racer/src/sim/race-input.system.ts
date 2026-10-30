import { ROOM_SOURCE, SeatLeave } from '@mcthaydt/automata-net/sim'
import { defineSystem, type EntityRef, type SystemDef } from '@mcthaydt/automata-sim'
import { RaceInput, RaceReset } from './race.command'
import { Race } from './race.resource'
import { HeldInput, Racer } from './racer.component'

// A seat's commands reach its racer (FloorFifty's `applyInputs`, the part that reads the frame). `race.input` replaces
// the held input; `race.reset` marks one respawn, resolved after this tick's contacts. A command from a seat with no
// racer, or outside a running race, changes nothing.
//
// The room sends `seat.leave` when a seat is given up: a consented leave, or a drop whose reconnect grace ran out. The
// racer then stays where it was, out of play (FloorFifty's ghost): no input, contacts, wrap, deaths or laps. A drop
// still inside the grace is the room's alone and never reaches the sim, so the racer keeps its held input until the
// seat comes back or is given up; a later `seat.join` of the same seat is a new player and does not take the racer
// over. The racer is not a `net-owner` entity, so net's seat system leaves it in place.

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
    for (const { source, payload } of ctx.commands.of(SeatLeave))
      if (source === ROOM_SOURCE) racerOf(racers, payload.seat)?.set(Racer, { connected: false })
  },
})
