// A light a character carries: whether it is lit, the fuel it has left in ticks, and how far its pool reaches. It is on the
// carrier's entity, so the snapshot carries it with everything else the carrier is.
import { type ComponentDef, defineComponent } from '@automata/sim'

const fields = {
  lit: 'bool',
  /** Fuel left, in sim ticks; a lit light burns one a tick. */
  fuelTicks: 'i32',
  /** The pool's radius in metres. */
  radius: 'f64',
} as const

export const CarriedLight: ComponentDef<typeof fields> = defineComponent('systems.carried-light', fields)
