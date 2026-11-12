// The `camera-view` content: the one definition of a view's fields, defaults and ranges
// (amended 2026-10-30, "one owner for camera-view"). It lives in the sim folder because the sim reads a view's
// `rotate` and `yawDeg` (the heading is sim state); the pure `./camera-view` entry re-exports it for the
// renderer and the 3D level editor. A view's id is its file's name (`content/camera-views/hall.toml` is `hall`),
// so the schema checks the file's fields and `CameraView` adds the id.
import { z } from 'zod'

/**
 * The default gameplay camera (Owner, 2026-11-10: the default 3D gameplay camera matches the reference game's): it follows the player, 30° down and 16 m back through a 50 mm lens (`LENS_MM`), a focus 1 m up,
 * easing the follow with a time constant of 1/7 s (the reference's `1 − e^(−7·dt)`), turned freely by the player in
 * 45° steps, and entering a zone 0.25 m inside it. A level overrides any of it per view; a zone that holds a fixed
 * angle sets `follow` below 1 and names its `look`.
 */
export const CAMERA_DEFAULTS: {
  readonly tiltDeg: number
  readonly distance: number
  readonly focusHeight: number
  readonly lag: number
  readonly rotate: boolean
  readonly follow: number
  readonly enterMargin: number
} = { tiltDeg: 30, distance: 16, focusHeight: 1, lag: 1 / 7, rotate: true, follow: 1, enterMargin: 0.25 }

/**
 * What a view is authored within; a number outside is a content error, never clamped. A zone's tilt is 25° to 40°
 * (the camera rules: "a zone may author a tilt from 25° to 40°"); the distance reaches 20 m because the reference game's
 * zones stand 15 to 16.6 m back.
 */
export const CAMERA_RANGES: {
  readonly tiltDeg: { readonly min: number; readonly max: number }
  readonly distance: { readonly min: number; readonly max: number }
  readonly lensMm: { readonly min: number; readonly max: number }
} = { tiltDeg: { min: 25, max: 40 }, distance: { min: 3, max: 20 }, lensMm: { min: 24, max: 200 } }

const point = z.tuple([z.number(), z.number(), z.number()])

/** A box in metres, `min` and `max` corners as `[x, y, z]`, as the 3D level editor's `Box3`. */
const box3Schema = z
  .strictObject({ min: point, max: point })
  .refine(({ min, max }) => min[0] <= max[0] && min[1] <= max[1] && min[2] <= max[2], {
    message: 'bounds: min must not pass max on any axis',
  })

const { tiltDeg, distance, lensMm } = CAMERA_RANGES

type Point = readonly [number, number, number]

const floorBox = z
  .strictObject({ min: z.tuple([z.number(), z.number()]), max: z.tuple([z.number(), z.number()]) })
  .refine(({ min, max }) => min[0] <= max[0] && min[1] <= max[1], {
    message: 'focusBounds: min must not pass max on either axis',
  })

/** A `camera-view` file's fields once compiled: the defaults filled in. */
export interface CameraViewFields {
  /** The heading the camera turns to when the view is entered (0 looks toward +z); omitted keeps the player's. */
  readonly yawDeg?: number | undefined
  /** Degrees the camera looks down, 25 to 40. */
  readonly tiltDeg: number
  /** Metres from the focus back along the view axis, 3 to 20. */
  readonly distance: number
  /**
   * The view's lens in millimetres, 24 to 200 (`fovOf`): none means the game's 50 mm (`LENS_MM`). A longer lens shows less of the
   * room at the same distance and flattens its perspective, so a game that draws its figures at a whole-pixel scale can set the
   * scale with the lens and keep the camera as far back as the room's walls need.
   */
  readonly lensMm?: number | undefined
  /** Metres above the followed position that the focus sits. */
  readonly focusHeight: number
  /** The focus is kept inside this box, so walls and doorways stay framed. */
  readonly bounds?: { readonly min: Point; readonly max: Point } | undefined
  /**
   * A locked-on view's (`follow` 1) focus box on the floor, `[x, z]` corners in metres: the look stays inside it however far the player
   * walks, so a camera that shows a narrow slice of a room (a long lens) stops at the room's edge and the player walks on across the frame.
   * Not the zone's `bounds`, which also say where the view is entered; a fixed zone keeps its own.
   */
  readonly focusBounds?:
    | { readonly min: readonly [number, number]; readonly max: readonly [number, number] }
    | undefined
  /**
   * How far the look leads a walking player, in metres, in the direction she walks (none: it trails her). The lead eases in as she walks
   * and out when she stops, so a camera that shows a narrow slice of the room shows what is ahead of her and not what she has passed.
   */
  readonly lead?: number | undefined
  /** The follow's time constant in seconds: the camera closes 63% of the gap in this long. 0 snaps. */
  readonly lag: number
  /** Whether the player may turn the camera here (false: an arena framed one way). */
  readonly rotate: boolean
  /**
   * 1 (the default) locks on: the look follows the player outside a small dead zone. Below 1 the zone holds a fixed
   * shot at its `look` and pans a little toward the player, inside `bounds`.
   */
  readonly follow: number
  /** The point a fixed zone looks at, in metres. Without one the look is the player's focus, so `follow` must be 1. */
  readonly look?: Point | undefined
  /** The camera's x when it is not above the look (a fixed zone's skew); omitted keeps it above `look`. */
  readonly x?: number | undefined
  /** How far a fixed zone's look follows the player in depth: `rate` per metre of z from `about`. */
  readonly depthFollow?: { readonly rate: number; readonly about: number } | undefined
  /** Metres inside this zone's `bounds` the player must be before the view is entered (the hysteresis). */
  readonly enterMargin: number
  /**
   * The sectors (by id) drawn while this view is active, besides the player's own room and what a peek or a cutscene adds
   * (`createRoomDraw`). Absent: every room is drawn.
   */
  readonly rooms?: readonly string[] | undefined
}

/** A `camera-view` file as written: every field optional. */
export type CameraViewInput = { readonly [K in keyof CameraViewFields]?: CameraViewFields[K] | undefined }

/** One `camera-view` file's fields. Omitted fields take `CAMERA_DEFAULTS`; unknown fields are refused. */
export const cameraViewSchema: z.ZodType<CameraViewFields, CameraViewInput> = z
  .strictObject({
    /** The heading the camera turns to when the view is entered (0 looks toward +z); omitted keeps the player's. */
    yawDeg: z.number().optional(),
    /** Degrees the camera looks down. */
    tiltDeg: z.number().min(tiltDeg.min).max(tiltDeg.max).default(CAMERA_DEFAULTS.tiltDeg),
    /** Metres from the focus back along the view axis. */
    distance: z.number().min(distance.min).max(distance.max).default(CAMERA_DEFAULTS.distance),
    /** The view's lens in millimetres; none keeps the game's 50 mm. */
    lensMm: z.number().min(lensMm.min).max(lensMm.max).optional(),
    /** Metres above the followed position that the focus sits. */
    focusHeight: z.number().min(0).default(CAMERA_DEFAULTS.focusHeight),
    /** The focus is kept inside this box, so walls and doorways stay framed. */
    bounds: box3Schema.optional(),
    /** A locked-on view's focus box on the floor: the look stays inside it. */
    focusBounds: floorBox.optional(),
    /** How far the look leads a walking player, in metres. */
    lead: z.number().min(0).max(8).optional(),
    /** Seconds of easing on the follow. */
    lag: z.number().min(0).default(CAMERA_DEFAULTS.lag),
    /** Whether the player may turn the camera here (false: an arena framed one way). */
    rotate: z.boolean().default(CAMERA_DEFAULTS.rotate),
    /** 1 locks on; below 1 the zone holds a fixed shot at `look` and pans a little. */
    follow: z.number().min(0).max(1).default(CAMERA_DEFAULTS.follow),
    /** The point a fixed zone looks at. */
    look: point.optional(),
    /** The camera's x when it is not above the look. */
    x: z.number().optional(),
    /** How far a fixed zone's look follows the player in depth. */
    depthFollow: z.strictObject({ rate: z.number(), about: z.number() }).optional(),
    /** Metres inside the zone's `bounds` the player must be before the view is entered. */
    enterMargin: z.number().min(0).default(CAMERA_DEFAULTS.enterMargin),
    /** The sectors drawn while this view is active; leave it out to draw every room. */
    rooms: z
      .array(z.string())
      .min(1, 'a view that draws no rooms is not one: leave `rooms` out to draw every room')
      .optional(),
  })
  .refine(({ follow, look }) => follow >= 1 || look !== undefined, {
    message: 'a fixed shot (follow below 1) needs a look to hold',
    path: ['look'],
  })

/** A compiled view: its id and its fields with the defaults filled in. */
export interface CameraView extends CameraViewFields {
  readonly id: string
}

/** The view `id` with `given` checked and the defaults filled in; throws a `ZodError` for a field out of range. */
export function cameraView(id: string, given: CameraViewInput = {}): CameraView {
  return { id, ...cameraViewSchema.parse(given) }
}
