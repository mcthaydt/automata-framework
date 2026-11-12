// What the prologue's `{ call }` effects do, for the puzzle solver, and which hotspots can be used when. The model is
// the game's own code (the solver's tools never import a game). Tests and tools only.
import type { Hotspot } from '@automata/interact/sim'
import { holds, type PuzzleModel, type State } from '@automata/puzzle/solver'

type Facts = Record<string, string | number | boolean>

const set = (state: State, facts: Facts): State => ({ ...state, facts: { ...state.facts, ...facts } })
const without = (state: State, item: string): State => {
  const items = [...state.items]
  const at = items.indexOf(item)
  if (at >= 0) items.splice(at, 1)
  return { ...state, items }
}

/**
 * The solver's model of the prologue over the level's hotspots. A hotspot is usable when its own `when` holds, so the
 * rule that the supply shelf and locker wait for the door lives in the level only; an action at a place the level does
 * not have is never available (the three act-one hotspots the prologue hides are not in the level).
 *
 * The only knowledge gate is the code, which Ada can type once she has read the handover note. Filling the lamp lights
 * it; snuffing and relighting it is play, not a step, so the model keeps it lit with some fuel. The figure's visit is
 * abstracted to making the bed (the bot waits it out behind the screen, task 12).
 */
export function modelOf(hotspots: readonly Hotspot[]): PuzzleModel {
  const byId = new Map(hotspots.map((spot) => [spot.id, spot]))
  return {
    facts: {},
    available: (state, at) => {
      // A place that is not a hotspot (`combine`, `code`) is always there; one the level lacks is not.
      const spot = byId.get(at)
      if (spot === undefined) return at === 'combine' || at === 'code'
      return (spot.when ?? []).every((cond) => holds(state, cond))
    },
    effects: {
      'bed.make': [
        { set: 'lightsOut', to: true },
        { set: 'figureGone', to: true },
      ],
    },
    require: { 'code.right': [{ fact: 'noteRead', is: true }] },
    calls: {
      read: (state) => [state],
      fill: (state) => [set(without(state, 'paraffin'), { fuel: 40, lit: true })],
    },
  }
}
