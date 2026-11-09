import { type ComponentDef, defineComponent } from '@automata/sim'

// Step 1 of the flow: the state. Heights and speeds are integers (subpixels per tick), so every engine computes
// the same numbers; `y` is the height above the floor, up is positive.

/** Upward speed a jump starts with. */
export const JUMP_SPEED = 600
/** Speed lost per tick while in the air. */
export const GRAVITY = 40
/** Jumps allowed after leaving the floor: one, which makes it a double jump. */
export const AIR_JUMPS = 1

const bodyFields = { y: 'i32', vy: 'i32', airJumps: 'u32' } as const

/** A body that falls to a flat floor and can jump; `airJumps` is how many jumps it has left in the air. */
export const Body: ComponentDef<typeof bodyFields> = defineComponent('body', bodyFields)
