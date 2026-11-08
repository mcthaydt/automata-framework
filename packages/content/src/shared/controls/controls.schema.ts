import { z } from 'zod'

// `content/controls.toml`: a game's default controls as data, the same things `keys()` takes in code. This file also
// owns what may be bound at all (the reserved keys and pad buttons, the stick directions and gestures), because the
// game's input profile and the Tuner both read the same lists and content sits below core.

/**
 * The highest button index of the W3C Gamepad standard mapping (0 = bottom face button … 16 = home). Only the
 * standard mapping is bound; a pad without it is the device layer's to normalize.
 */
export const STANDARD_PAD_BUTTON_MAX = 16

/**
 * Never bindable in a game's profile: Ruken's SDK summons the host on pad 8 (View), 16 is Home, Escape is the
 * one back path and Tab moves focus.
 */
export const RESERVED_PAD_BUTTONS: readonly number[] = [8, 16]
/** Keys never bindable in a game's profile: Escape (the one back path) and Tab (focus). */
export const RESERVED_KEYS: readonly string[] = ['Escape', 'Tab']

/** The eight stick directions a stick action can be bound to: each stick's up, down, left and right. */
export const STICK_DIRECTIONS = [
  'left-up',
  'left-down',
  'left-left',
  'left-right',
  'right-up',
  'right-down',
  'right-left',
  'right-right',
] as const
/**
 * `camera-drag` is analog: a one-finger or secondary-button drag whose horizontal pixels
 * `Input.cameraDrag()` reads. It never holds or pulses an action; binding it is what turns the drag on.
 */
export const GESTURE_NAMES = [
  'swipe-left',
  'swipe-right',
  'swipe-up',
  'swipe-down',
  'flick-down',
  'tap',
  'camera-drag',
] as const

/** A stick pushed past its dead zone in one direction (the input service reads them). */
export type StickDirection = (typeof STICK_DIRECTIONS)[number]
/** A touch gesture (the swipes, flick, tap and the camera drag). */
export type GestureName = (typeof GESTURE_NAMES)[number]

/** One action: what it sends, and every way to do it. */
export interface ControlAction {
  readonly id: string
  /** Its name in the Controls section of Settings and in the Tuner. */
  readonly label?: string | undefined
  /** The command's fields this action sets while held. The game checks them against the command's own schema. */
  readonly send: Readonly<Record<string, unknown>>
  readonly keys?: readonly string[] | undefined
  readonly pad?: readonly number[] | undefined
  /** Whether the play screen shows a button for it on touch screens. Default yes, when it has a key. */
  readonly touch?: boolean | undefined
  readonly stick?: readonly StickDirection[] | undefined
  readonly gesture?: readonly GestureName[] | undefined
  /** The game cannot be played without it: rebinding never leaves it unbound. */
  readonly required?: boolean | undefined
}

/** What `content/controls.toml` holds. */
export interface ControlsFile {
  /** The id of the command the actions send. */
  readonly command: string
  readonly action: readonly ControlAction[]
}

const keySchema = z
  .string()
  .min(1)
  .refine((code) => !RESERVED_KEYS.includes(code), { message: 'That key is kept for the menus.' })
const padSchema = z
  .number()
  .int()
  .min(0)
  .max(STANDARD_PAD_BUTTON_MAX)
  .refine((button) => !RESERVED_PAD_BUTTONS.includes(button), {
    message: 'That button is kept for the menus.',
  })

const controlActionSchema = z.strictObject({
  id: z.string().min(1),
  label: z.string().min(1).optional(),
  send: z.record(z.string(), z.unknown()),
  keys: z.array(keySchema).optional(),
  pad: z.array(padSchema).optional(),
  touch: z.boolean().optional(),
  stick: z.array(z.enum(STICK_DIRECTIONS)).optional(),
  gesture: z.array(z.enum(GESTURE_NAMES)).optional(),
  required: z.boolean().optional(),
})

const NO_ACTIONS = 'A controls file needs at least one action.'

/** The schema of `content/controls.toml`: at least one action, and no two with one id. */
export const controlsFileSchema: z.ZodType<ControlsFile> = z
  .strictObject({
    command: z.string().min(1),
    action: z.array(controlActionSchema, { error: NO_ACTIONS }).min(1, NO_ACTIONS),
  })
  .superRefine((file, ctx) => {
    const seen = new Set<string>()
    for (const [index, action] of file.action.entries()) {
      if (seen.has(action.id))
        ctx.addIssue({
          code: 'custom',
          path: ['action', index, 'id'],
          message: `Two actions are called "${action.id}".`,
        })
      seen.add(action.id)
    }
  })
