// base-3d's Koota traits. Positions are Q16.16 metres and angles turn units (constants.ts); the renderer converts
// them to metres and radians. The camera's view and heading are @automata/3d's `camera-heading`, on the same entity as
// `hero`.
import { type ComponentDef, defineComponent } from '@automata/sim'

const heroFields = {
  x: 'i32',
  z: 'i32',
  /** Where Wick faces, in turn units (0 toward +z, growing toward +x). */
  facing: 'u32',
  /** Whether he moved this tick. */
  moving: 'bool',
  /** His travel relative to his facing, in turn units (0 forward: he always faces the way he travels). */
  moveDir: 'i32',
} as const

/** Wick, the player, as the renderer reads him (the figure's `FigureState`). */
export const Hero: ComponentDef<typeof heroFields> = defineComponent('hero', heroFields)

const controlFields = {
  stickX: 'i32',
  stickY: 'i32',
  rollHeld: 'bool',
  /** True only on the tick the roll button went down, so holding it never rolls again. */
  rollPressed: 'bool',
} as const

/** This tick's input: the stick (−127..127, y down) and the roll button. Not rendered. */
export const HeroControl: ComponentDef<typeof controlFields> = defineComponent(
  'hero-control',
  controlFields,
  { render: false },
)

const actionFields = {
  /** The action playing, as `ACTION_CLIP` (0 none, 1 roll). */
  clip: 'u32',
  /** The tick it started on: the figure samples its clip from here. */
  startedAt: 'u32',
  /** The roll's push a tick, Q16.16 metres, for `pushTicks` more ticks. */
  pushX: 'i32',
  pushZ: 'i32',
  pushTicks: 'u32',
} as const

/** Wick's action, as the figure reads it (`FigureState.action`), and the roll under way. */
export const HeroAction: ComponentDef<typeof actionFields> = defineComponent('hero-action', actionFields)
