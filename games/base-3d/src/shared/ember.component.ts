// base-3d's ember trait: a point in the room Wick can take. Sim code: `pnpm boundaries` checks it.
import { type ComponentDef, defineComponent } from '@automata/sim'

const emberFields = {
  x: 'i32',
  z: 'i32',
  /** The goal ember: taking it ends the run. */
  goal: 'bool',
  /** Its place in the area's list, the goal last: what a save records as taken. */
  index: 'u32',
} as const

/** An ember waiting to be taken: it is removed when Wick comes within `EMBER_REACH`. */
export const Ember: ComponentDef<typeof emberFields> = defineComponent('ember', emberFields)
