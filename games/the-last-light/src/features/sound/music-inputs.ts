import { CutsceneState } from '@automata/cutscenes/sim'
import type { DrawSim } from '@automata/framework'
import { PuzzleState } from '@automata/puzzle/sim'
import { SystemsPursuit, SystemsState } from '@automata/systems/sim'
import type { MusicInputs } from './music-state.ts'

/** The figure of the creature's file: the one whose mode the music follows. */
const FIGURE = 'nurse'

/** The night with the lamps on and nothing happening: what the music reads before the screen has a sim. */
export const CALM: MusicInputs = {
  paused: false,
  keypadOpen: false,
  inCutscene: false,
  lightsOut: false,
  figureMode: 'dormant',
  hidden: false,
}

/** What the music asks of the running game, read from the draw layer's view of the sim. */
export function musicInputsOf(sim: DrawSim | undefined, keypadOpen: boolean): MusicInputs {
  if (sim === undefined) return CALM
  return {
    // The pause menu holds the sim and the music goes on under it; the page does not tell the sim it is paused.
    paused: false,
    keypadOpen,
    inCutscene: sim.resource(CutsceneState).id !== null,
    lightsOut: sim.resource(PuzzleState).facts.lightsOut === true,
    figureMode: sim.resource(SystemsState).agents[FIGURE]?.mode ?? 'dormant',
    hidden: sim.resource(SystemsPursuit).hidden !== '',
  }
}
