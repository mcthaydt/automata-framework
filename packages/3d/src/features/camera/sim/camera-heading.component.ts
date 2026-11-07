import { type ComponentDef, defineComponent } from '@automata/sim'

const fields = {
  /** The id of the `camera-view` the player is in; '' before the first. */
  view: 'string',
  /** The camera's heading in turn units, 0..65,535. */
  heading: 'u32',
  /** Whether the view lets the player turn the camera (copied from the view on entry). */
  rotate: 'bool',
  /** Whether the stick still maps through `latchHeading` after a view change (M3R-D15). */
  latched: 'bool',
  latchHeading: 'u32',
  /** The stick when the latch was taken: it lets go once the stick points more than 90° away. */
  latchX: 'i32',
  latchY: 'i32',
} as const

/**
 * The camera's heading as sim state, on the player: the view it is in, the heading and the stick's
 * view-change latch. A render component, so the renderer reads `view` and `heading` from the rows.
 */
export const CameraHeading: ComponentDef<typeof fields> = defineComponent('camera-heading', fields)
