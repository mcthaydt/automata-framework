import { type ComponentDef, defineComponent } from '@mcthaydt/automata-sim'

const playerFields = { x: 'i32', y: 'i32', vx: 'i32', vy: 'i32', facing: 'i32', grounded: 'bool' } as const

/**
 * The character, as the renderer sees it. `x`, `y` are the hitbox's top-left corner and `vx`, `vy` its speed,
 * in subpixels (tuning.ts); `facing` is 1 (right) or -1 (left).
 */
export const Player: ComponentDef<typeof playerFields> = defineComponent('player', playerFields)

const controlFields = {
  moveX: 'i32',
  jumpHeld: 'bool',
  jumpPressed: 'bool',
  coyote: 'u32',
  buffer: 'u32',
  varJump: 'u32',
} as const

/**
 * This tick's input and the jump timers, in ticks left. Not rendered. `jumpPressed` is true only on the tick
 * jump goes down, so holding it does not jump again on landing.
 */
export const PlayerControl: ComponentDef<typeof controlFields> = defineComponent(
  'player-control',
  controlFields,
  {
    render: false,
  },
)
