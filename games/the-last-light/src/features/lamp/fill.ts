import { PuzzleState } from '@automata/puzzle/sim'
import type { SimContext } from '@automata/sim'
import { CarriedLight, type CarriedLightDef, refill } from '@automata/systems/sim'

/**
 * The puzzle's `fill` call: the paraffin goes into the lamp (it is used up), the tank fills by the file's refill and is
 * never fuller than its cap, and the lamp is lit. The drawer always has one more bottle (the puzzle's `nightstand`
 * counter), so a lamp that ran dry in the supply room can still be filled.
 */
export function fillLamp(def: CarriedLightDef) {
  return (ctx: SimContext): void => {
    const state = ctx.resource(PuzzleState)
    const at = state.items.indexOf('paraffin')
    if (at >= 0) state.items.splice(at, 1)
    const [carrier] = ctx.query(CarriedLight)
    if (carrier === undefined) return
    refill(ctx, carrier.sid, def)
    carrier.set(CarriedLight, { lit: true })
  }
}
