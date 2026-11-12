import type { PuzzleOptions } from '@automata/puzzle/sim'
import { CarriedLight } from '@automata/systems/sim'
import { TICK_HZ } from '../../shared/constants.ts'

type Facts = NonNullable<PuzzleOptions['facts']>

/**
 * The puzzle facts the lamp keeps itself (T6: only these two are mapped; every other fact is the puzzle's own): `lit`,
 * whether Ada's light is lit, and `fuel`, the seconds of paraffin in it. The puzzle and the creature's rules read them; only
 * the light's own toggle, burn and refill change them, so a file cannot set them.
 */
export const lampFacts: Facts = {
  get(ctx, name) {
    if (name !== 'lit' && name !== 'fuel') return undefined
    const [carrier] = ctx.query(CarriedLight)
    // Before she has the lamp there is no light: not lit, no fuel.
    if (carrier === undefined) return name === 'lit' ? false : 0
    const light = carrier.get(CarriedLight)
    return name === 'lit' ? light.lit : Math.ceil(light.fuelTicks / TICK_HZ)
  },
  set: () => false,
}
