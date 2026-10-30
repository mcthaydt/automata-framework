// base-3d's Koota traits (DESIGN.md §3.1). Positions are Q16.16 metres and angles turn units (constants.ts); the
// renderer converts them to metres and radians (M3.7b). The camera's view and heading are render-pixi3d's
// `camera-heading`, on the same entity as `hero` (M3 spec §4.2, one owner).
import { type ComponentDef, defineComponent } from '@mcthaydt/automata-sim'

const heroFields = {
  x: 'i32',
  z: 'i32',
  /** Where Wick faces, in turn units (0 toward +z, growing toward +x). */
  facing: 'u32',
  /** Whether the stick moved him this tick. */
  moving: 'bool',
  /** His travel relative to his facing, in turn units: 0 forward, ±16,384 a strafe, −32,768 backing away. */
  moveDir: 'i32',
  /** The entity he is locked onto; 0 when none. */
  lockTarget: 'entity',
} as const

/** Wick, the player, as the renderer reads him (the figure's `FigureState`, M3 spec §4.4.5). */
export const Hero: ComponentDef<typeof heroFields> = defineComponent('hero', heroFields)

const controlFields = { stickX: 'i32', stickY: 'i32', lockHeld: 'bool' } as const

/** This tick's input: the stick (−127..127, y down) and whether lock is held. Not rendered. */
export const HeroControl: ComponentDef<typeof controlFields> = defineComponent(
  'hero-control',
  controlFields,
  {
    render: false,
  },
)

const targetFields = { x: 'i32', z: 'i32' } as const

/** Something Wick can lock onto, standing at `x`, `z`. */
export const Target: ComponentDef<typeof targetFields> = defineComponent('target', targetFields)
