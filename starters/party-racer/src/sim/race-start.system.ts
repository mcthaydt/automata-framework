import { ROOM_SOURCE } from '@mcthaydt/automata-net/sim'
import { BodyKind, body2d, collider2d, transform2d } from '@mcthaydt/automata-physics/2d'
import { defineSystem, type SimContext, type SystemDef } from '@mcthaydt/automata-sim'
import { createCourse } from './course.generator'
import { Floor } from './floor.component'
import { RaceStart } from './race.command'
import { Race } from './race.resource'
import { FLOOR_GROUPS, freshVisited, RACER_GROUPS, spawnPoint } from './race-rules'
import { HeldInput, Racer } from './racer.component'
import type { RaceTuning } from './tuning.schema'

// `race.start`: build the course and seat the racers (FloorFifty's `createRaceState` and `createPlanckWorld`).
//
// Spawn order is part of determinism: Rapier's broad phase and solver visit bodies in the order they were made, so
// floors are spawned in index order and racers in seat order, never in the order the seats were listed.

/** Restitution and friction are zero on every solid: the bounce is the rules', and input owns horizontal speed. */
const MATERIAL = { friction: 0, restitution: 0 } as const

function startRace(ctx: SimContext, tuning: RaceTuning, courseSeed: number, seats: readonly number[]): void {
  const course = createCourse(courseSeed, tuning)
  const floorShape = collider2d.cuboid(tuning.floorWidth / 2, tuning.floorHeight / 2, {
    ...MATERIAL,
    groups: FLOOR_GROUPS,
  })
  for (const floor of course.floors) {
    const rules = [
      Floor,
      { index: floor.index, moving: floor.moving, speed: floor.speed, direction: 1, x: floor.x, shift: 0 },
    ] as const
    // A still floor is a lone collider (fixed); a moving one a kinematic body steered by velocity.
    if (floor.moving)
      ctx.spawn(
        transform2d({ x: floor.x, y: floor.y }),
        body2d(BodyKind.kinematicVelocity),
        floorShape,
        rules,
      )
    else ctx.spawn(transform2d({ x: floor.x, y: floor.y }), floorShape, rules)
  }
  const spawn = spawnPoint(tuning)
  for (const seat of [...seats].sort((a, b) => a - b))
    ctx.spawn(
      transform2d(spawn),
      // Kinematic until the first input: it neither falls nor is pushed (FloorFifty's inactive body, 8b-D2).
      body2d(BodyKind.kinematicPosition),
      collider2d.cuboid(tuning.racerWidth / 2, tuning.racerHeight / 2, { ...MATERIAL, groups: RACER_GROUPS }),
      [
        Racer,
        {
          seat,
          lap: 1,
          visited: freshVisited(tuning.floorCount),
          connected: true,
          awaitingInput: true,
          facingRight: true,
          holdUntil: -1,
          finishedAt: -1,
        },
      ],
      HeldInput,
    )
  const race = ctx.resource(Race)
  race.phase = 'racing'
  race.startedAt = ctx.tick
  race.courseSeed = courseSeed
}

/**
 * Takes the first `race.start` from the room while the race is waiting; any later one, and any from a seat, is
 * ignored. The server forwards every game command a client sends (only net's seat commands are room-only), so the
 * sim checks the source itself: a seat must not choose the course or who races.
 */
export function raceStartSystem(tuning: RaceTuning): SystemDef {
  return defineSystem({
    name: 'party-racer.start',
    phase: 'input',
    run(ctx) {
      for (const { source, payload } of ctx.commands.of(RaceStart))
        if (source === ROOM_SOURCE && ctx.resource(Race).phase === 'waiting')
          startRace(ctx, tuning, payload.courseSeed, payload.seats)
    },
  })
}
