import { type ComponentDef, defineComponent } from '@mcthaydt/automata-sim'

// A course floor (FloorFifty's `Floor` and its `movingFloors` entry). The physics body follows `x`: a moving floor's
// kinematic body is steered onto it by velocity each tick, so there is one answer to where a floor is.

const floorFields = {
  index: 'u32',
  moving: 'bool',
  /** m/s; 0 for a still floor. */
  speed: 'f64',
  /** +1 rightward, -1 leftward. */
  direction: 'i32',
  /** Where the rules put the floor's centre this tick. */
  x: 'f64',
  /** How far `x` moved this tick: what a racer standing on the floor is carried by. */
  shift: 'f64',
} as const

/** A course floor's rules state. */
export const Floor: ComponentDef<typeof floorFields> = defineComponent('party-racer.floor', floorFields)
