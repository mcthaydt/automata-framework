// base-3d's save, captured from and applied to the sim (DESIGN.md §12.1): outside the sim boundary, so the sim never
// sees the save. The sim holds only what it changes (`Progress`); every other field, unknown ones included, is kept
// from the slot last applied, so a write never drops what a load brought in. Continue always starts a fresh sim at
// the area's entrance (GAME3D-D9): nothing here moves Wick.
import type { GameSaves } from '@mcthaydt/automata-game'
import type { Sim } from '@mcthaydt/automata-sim'
import { Progress } from '../resources.ts'
import { type Base3dSave, base3dSave, newGame } from '../state/save.ts'

/** One game's saves: `defineGame`'s `saves`. A new instance per game, since it remembers the slot it applied. */
export function base3dSaves(): GameSaves<Base3dSave> {
  let applied = newGame()
  return {
    def: base3dSave,
    capture: (sim: Sim) => ({
      ...applied,
      embers: sim.resource(Progress).embers,
      // The sim starts at tick 0 on every Continue, so the play time is the slot's plus this sim's.
      playTicks: applied.playTicks + sim.tick,
    }),
    apply: (sim: Sim, data: Base3dSave) => {
      applied = data
      sim.resource(Progress).embers = data.embers
    },
  }
}
