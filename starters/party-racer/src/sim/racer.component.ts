import { type ComponentDef, defineComponent } from '@mcthaydt/automata-sim'

// A racer's race state (FloorFifty's `PlayerState`, the fields the race-mode sim reads). Its position and velocity are
// the physics components' (`Transform2D`, `RigidBody2D`); these are the rules' own.

const racerFields = {
  /** The seat that steers this racer: its commands carry `source` = seat. */
  seat: 'u32',
  /** One-based ascent the racer is climbing. */
  lap: 'u32',
  /** Floors credited this ascent, one character per floor index: '1' credited, '0' not. The start floor is '1'. */
  visited: 'string',
  /** True from the start until the racer's first input: they stand at the spawn and nothing moves them. */
  awaitingInput: 'bool',
  facingRight: 'bool',
  /** True on the tick a top contact resolved (a landing). Read within a tick, by presentation. */
  grounded: 'bool',
  /** After a lap, the racer rests at the spawn until this tick; -1 when not held. */
  holdUntil: 'i32',
  /** Ticks from the race's start to this racer's finish; -1 until they finish. */
  finishedAt: 'i32',
  /** A `race.reset` arrived this tick; resolved after the contacts, then cleared. */
  resetRequested: 'bool',
  /** The velocity the racer entered this tick's physics step with: the contact rules' approach test reads it. */
  enterVx: 'f32',
  enterVy: 'f32',
} as const

/** A racer's rules state. */
export const Racer: ComponentDef<typeof racerFields> = defineComponent('party-racer.racer', racerFields)

const heldInputFields = { left: 'bool', right: 'bool', fastFall: 'bool' } as const
/** The input a seat is holding: set by `race.input`, in force until the next one. */
export const HeldInput: ComponentDef<typeof heldInputFields> = defineComponent(
  'party-racer.held-input',
  heldInputFields,
  { render: false },
)
