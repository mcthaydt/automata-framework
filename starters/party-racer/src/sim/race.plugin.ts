import { netPlugin } from '@mcthaydt/automata-net/sim'
import { physics2d } from '@mcthaydt/automata-physics/2d'
import { definePlugin, type PluginDef } from '@mcthaydt/automata-sim'
import { Floor } from './floor.component'
import { RaceInput, RaceReset, RaceStart } from './race.command'
import { FloorLanded, LapCompleted, RaceFinished, RacerReset } from './race.event'
import { Race } from './race.resource'
import { raceInputSystem } from './race-input.system'
import { raceStartSystem } from './race-start.system'
import { racePostStepSystem, racePreStepSystem } from './race-step.system'
import { HeldInput, Racer } from './racer.component'
import { checkTickRate } from './tick-rate'
import { type RaceTuning, raceTuningSchema } from './tuning.schema'

/**
 * The Party Racer's sim: net's seats (the server requires `netPlugin`; the race reads `seat.leave`), Rapier 2D
 * physics with the tuning's gravity, then the race. The list already includes `netPlugin`: do not add it again. Create
 * the sim at `RACE_TICK_HZ`; createSim fails at any other rate. The tuning is validated here and
 * is part of the race plugin's config, so a different tuning is a different schema hash: two sims on different
 * numbers never accept each other's snapshots.
 */
export function racePlugins(tuning: RaceTuning): PluginDef[] {
  const checked = raceTuningSchema.parse(tuning)
  return [
    netPlugin,
    physics2d({ gravity: { x: 0, y: checked.gravity } }),
    definePlugin({
      name: 'party-racer',
      dependsOn: ['net', 'physics-2d'],
      config: { tuning: checked },
      state: checkTickRate,
      components: [Racer, HeldInput, Floor],
      resources: [Race],
      commands: [RaceStart, RaceInput, RaceReset],
      events: [FloorLanded, LapCompleted, RacerReset, RaceFinished],
      systems: [
        raceStartSystem(checked),
        raceInputSystem,
        racePreStepSystem(checked),
        racePostStepSystem(checked),
      ],
    }),
  ]
}
