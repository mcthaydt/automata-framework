// What a game's analog mapping reads each tick: the sticks, the camera drag and the camera settings.

import type { z } from 'zod'
import type { CameraSettings } from './analog/camera-settings.schema.ts'
import type { Input } from './input.manager.ts'

/** The analog input at one fixed step, read once after `Input.poll()`. */
export interface AnalogReading {
  /** The active pad's stick, or the touch stick, as integers −127..127. */
  stick(side: 'left' | 'right'): { readonly x: number; readonly y: number }
  /** CSS px dragged to the right since the previous tick; 0 unless the map binds the camera drag. */
  cameraDrag(): number
  /** The player's camera settings. */
  readonly camera: CameraSettings
}

/** The `analog` option of `keys()`. */
export interface AnalogOptions<Z extends z.ZodType> {
  /**
   * Per tick: what the sticks and the drag add to the held keys' payload, merged over it and parsed by the
   * command's schema. The held payload is passed in so a game can sum a key term and a stick term. When the schema
   * refuses the merge (a `NaN`, a float in an integer field), the held payload is sent alone.
   */
  read(reading: AnalogReading, held: z.output<Z>): Partial<z.input<Z>>
  /** Bind the `camera-drag` gesture: the play screen mounts the drag surface. */
  readonly drag?: boolean
  /** Show the touch stick; its vector is `stick('left')`. */
  readonly touchStick?: boolean
}

/** The reading over an `Input`. */
export const analogReading = (
  input: Pick<Input, 'stick' | 'cameraDrag'>,
  camera: CameraSettings,
): AnalogReading => ({ stick: (side) => input.stick(side), cameraDrag: () => input.cameraDrag(), camera })
