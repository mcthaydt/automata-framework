// The HUD's state, read from the running sim each animation frame: the embers taken and how many there are. Presentation:
// it only reads the sim (law 1).
import type { Sim } from '@mcthaydt/automata-sim'
import { Ember } from '../components.ts'
import { Progress } from '../resources.ts'

export interface HudState {
  readonly embers: number
  /** The embers taken and still standing: the area's whole list, the goal included. */
  readonly total: number
}

/** The running sim, given by the screens' `watchSim` (screens.ts). */
export const hudInPlay: { sim: Sim | undefined } = { sim: undefined }

/** What the HUD shows of `sim`; nothing without one (before play has a sim, or after it ends). */
export function hudOf(sim: Sim | undefined): HudState | undefined {
  if (sim === undefined) return undefined
  const taken = sim.resource(Progress).taken.length
  return { embers: taken, total: taken + sim.query(Ember).length }
}
