// The `camera-view` content (M3 spec §4.2, M3R-D11): the one definition of a view's fields, defaults and ranges
// (amended 2026-10-30, "one owner for camera-view"). It lives in the sim folder because the sim reads a view's
// `rotate` and `yawDeg` (the heading is sim state); the pure `./camera-view` entry re-exports it for the
// renderer and the 3D level editor. A view's id is its file's name (`content/camera-views/hall.toml` is `hall`),
// so the schema checks the file's fields and `CameraView` adds the id.
import { z } from 'zod'

/** The Owner's view (2026-10-23): 25° down, 5 m back, a focus 1 m up, 0.18 s of lag, turned freely. */
export const CAMERA_DEFAULTS: {
  readonly tiltDeg: number
  readonly distance: number
  readonly focusHeight: number
  readonly lag: number
  readonly rotate: boolean
} = { tiltDeg: 25, distance: 5, focusHeight: 1, lag: 0.18, rotate: true }

/** What a view is authored within (M3R-D11); a number outside is a content error, never clamped. */
export const CAMERA_RANGES: {
  readonly tiltDeg: { readonly min: number; readonly max: number }
  readonly distance: { readonly min: number; readonly max: number }
} = { tiltDeg: { min: 15, max: 60 }, distance: { min: 3, max: 12 } }

const point = z.tuple([z.number(), z.number(), z.number()])

/** A box in metres, `min` and `max` corners as `[x, y, z]`, as the 3D level editor's `Box3`. */
const box3Schema = z
  .strictObject({ min: point, max: point })
  .refine(({ min, max }) => min[0] <= max[0] && min[1] <= max[1] && min[2] <= max[2], {
    message: 'bounds: min must not pass max on any axis',
  })

const { tiltDeg, distance } = CAMERA_RANGES

type Point = [number, number, number]

/** A `camera-view` file's fields once compiled: the defaults filled in. */
export interface CameraViewFields {
  /** The heading the camera turns to when the view is entered (0 looks toward +z); omitted keeps the player's. */
  readonly yawDeg?: number | undefined
  /** Degrees the camera looks down, 15 to 60. */
  readonly tiltDeg: number
  /** Metres from the focus back along the view axis, 3 to 12. */
  readonly distance: number
  /** Metres above the followed position that the focus sits. */
  readonly focusHeight: number
  /** The focus is kept inside this box, so walls and doorways stay framed. */
  readonly bounds?: { readonly min: Point; readonly max: Point } | undefined
  /** Seconds of easing on the follow. */
  readonly lag: number
  /** Whether the player may turn the camera here (false: an arena framed one way). */
  readonly rotate: boolean
}

/** A `camera-view` file as written: every field optional. */
export type CameraViewInput = { readonly [K in keyof CameraViewFields]?: CameraViewFields[K] | undefined }

/** One `camera-view` file's fields. Omitted fields take `CAMERA_DEFAULTS`; unknown fields are refused. */
export const cameraViewSchema: z.ZodType<CameraViewFields, CameraViewInput> = z.strictObject({
  /** The heading the camera turns to when the view is entered (0 looks toward +z); omitted keeps the player's. */
  yawDeg: z.number().optional(),
  /** Degrees the camera looks down. */
  tiltDeg: z.number().min(tiltDeg.min).max(tiltDeg.max).default(CAMERA_DEFAULTS.tiltDeg),
  /** Metres from the focus back along the view axis. */
  distance: z.number().min(distance.min).max(distance.max).default(CAMERA_DEFAULTS.distance),
  /** Metres above the followed position that the focus sits. */
  focusHeight: z.number().min(0).default(CAMERA_DEFAULTS.focusHeight),
  /** The focus is kept inside this box, so walls and doorways stay framed. */
  bounds: box3Schema.optional(),
  /** Seconds of easing on the follow. */
  lag: z.number().min(0).default(CAMERA_DEFAULTS.lag),
  /** Whether the player may turn the camera here (false: an arena framed one way). */
  rotate: z.boolean().default(CAMERA_DEFAULTS.rotate),
})

/** A compiled view: its id and its fields with the defaults filled in. */
export interface CameraView extends CameraViewFields {
  readonly id: string
}

/** The view `id` with `given` checked and the defaults filled in; throws a `ZodError` for a field out of range. */
export function cameraView(id: string, given: CameraViewInput = {}): CameraView {
  return { id, ...cameraViewSchema.parse(given) }
}
