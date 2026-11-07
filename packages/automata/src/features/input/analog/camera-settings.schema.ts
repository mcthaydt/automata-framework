import { z } from 'zod'

/**
 * The range of "Camera turn speed" in degrees per dragged pixel: 0.25° by default,
 * so a 1,440 px sweep is one full turn. A Settings slider steps through it.
 */
export const CAMERA_TURN_SPEED = { min: 0.05, max: 1, step: 0.05, default: 0.25 } as const

/**
 * The player's camera choices, `camera` in the core settings: how far a dragged pixel turns the camera, and whether
 * the turn is inverted. The one owner of their shape: the game's Settings rows and its command mapping
 * (`turnUnitsFromPixels`) read them from here.
 */
export interface CameraSettings {
  readonly degPerPixel: number
  readonly invert: boolean
}

/** The camera choices a new player starts with: the default turn speed, not inverted. */
export const CAMERA_SETTINGS_DEFAULT: CameraSettings = {
  degPerPixel: CAMERA_TURN_SPEED.default,
  invert: false,
}

/**
 * A missing, malformed or out-of-range field reads as its default, keeping the other; a record that is not an
 * object reads as the defaults, as every settings field falls back.
 */
export const cameraSettingsSchema: z.ZodType<CameraSettings, unknown> = z
  .object({
    degPerPixel: z
      .number()
      .min(CAMERA_TURN_SPEED.min)
      .max(CAMERA_TURN_SPEED.max)
      .catch(CAMERA_SETTINGS_DEFAULT.degPerPixel),
    invert: z.boolean().catch(CAMERA_SETTINGS_DEFAULT.invert),
  })
  .catch(CAMERA_SETTINGS_DEFAULT)
