// base-3d's save, captured from and applied to the sim (outside the sim boundary, so the sim never sees the save). The
// sim holds only what it changes (`Progress`); every other field, unknown ones included, is kept from the slot applied
// to that sim, so a write never drops what a load brought in. Continue starts a fresh sim at the spawn; the sim
// removes the embers the save says are taken (`ember.take`).
import type { GameSaves } from '@mcthaydt/automata-game'
import type { Sim } from '@mcthaydt/automata-sim'
import { Progress } from '../resources.ts'
import { type Base3dSave, base3dSave, newGame } from '../state/save.ts'

/** One game's saves: `defineGame`'s `saves`. A new instance per game, since it remembers the slot it applied. */
export function base3dSaves(): GameSaves<Base3dSave> {
  // The slot applied to each sim (a disposed sim's entry goes with it).
  const appliedTo = new WeakMap<Sim, Base3dSave>()
  return {
    def: base3dSave,
    capture: (sim: Sim) => {
      const applied = appliedTo.get(sim) ?? newGame()
      const { taken, goal } = sim.resource(Progress)
      return {
        ...applied,
        taken: [...taken],
        goal,
        // The sim starts at tick 0 on every Continue, so the play time is the slot's plus this sim's.
        playTicks: applied.playTicks + sim.tick,
      }
    },
    apply: (sim: Sim, data: Base3dSave) => {
      appliedTo.set(sim, data)
      const progress = sim.resource(Progress)
      progress.taken = [...data.taken].sort((a, b) => a - b)
      progress.goal = data.goal
    },
  }
}
