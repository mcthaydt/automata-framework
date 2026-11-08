import {
  GESTURE_NAMES,
  type GestureName,
  RESERVED_KEYS,
  RESERVED_PAD_BUTTONS,
  STANDARD_PAD_BUTTON_MAX,
  STICK_DIRECTIONS,
  type StickDirection,
} from '@automata/content/controls'
import { z } from 'zod'

export type { GestureName, StickDirection }
// What may be bound (the reserved keys and buttons, the stick directions and gestures) is content's, so the Tuner and
// the controls file read the same lists.
export { RESERVED_KEYS, RESERVED_PAD_BUTTONS, STANDARD_PAD_BUTTON_MAX }

/** Where an action is live: during play, in menus, or both. */
export type InputContext = 'play' | 'menu' | 'any'

/** What drives one action: keys by `KeyboardEvent.code` (layout independent), pad buttons, an on-screen button. */
export interface InputBinding {
  readonly keys: readonly string[]
  readonly pad: readonly number[]
  readonly touch: boolean
  readonly stick?: readonly StickDirection[] | undefined
  readonly gesture?: readonly GestureName[] | undefined
  /** Rebinding may never leave it unbound on a device it had. */
  readonly required?: boolean | undefined
  /** Default `'play'`. */
  readonly context?: InputContext | undefined
}

/**
 * A named set of bindings, one per game action. It is data: a settings screen rebinds a
 * copy and saves it in the game's `SettingsDef`; the input service reads it. Action ids are the game's own.
 */
export interface InputProfile {
  readonly id: string
  readonly bindings: Readonly<Record<string, InputBinding>>
}

/** What `inputProfileSchema` accepts: every binding field may be left out. */
export interface InputProfileInput {
  readonly id: string
  readonly bindings: Readonly<
    Record<
      string,
      {
        readonly keys?: readonly string[] | undefined
        readonly pad?: readonly number[] | undefined
        readonly touch?: boolean | undefined
        readonly stick?: readonly StickDirection[] | undefined
        readonly gesture?: readonly GestureName[] | undefined
        readonly required?: boolean | undefined
        readonly context?: InputContext | undefined
      }
    >
  >
}

const bindingSchema = z.object({
  keys: z.array(z.string().min(1)).default([]),
  pad: z.array(z.number().int().min(0).max(STANDARD_PAD_BUTTON_MAX)).default([]),
  touch: z.boolean().default(false),
  stick: z.array(z.enum(STICK_DIRECTIONS)).optional(),
  gesture: z.array(z.enum(GESTURE_NAMES)).optional(),
  required: z.boolean().optional(),
  context: z.enum(['play', 'menu', 'any']).optional(),
})

/**
 * Validates an input profile, filling left-out binding fields with "unbound". A reserved key or pad button fails
 * the parse with the action named: at boot that is a developer error before anything renders.
 */
export const inputProfileSchema: z.ZodType<InputProfile, InputProfileInput> = z
  .object({
    id: z.string().min(1),
    bindings: z.record(z.string().min(1), bindingSchema),
  })
  .superRefine((profile, ctx) => {
    for (const [action, binding] of Object.entries(profile.bindings)) {
      for (const button of binding.pad)
        if (RESERVED_PAD_BUTTONS.includes(button))
          ctx.addIssue({
            code: 'custom',
            path: ['bindings', action, 'pad'],
            message: `"${action}" binds pad button ${button}, which is reserved for the host`,
          })
      for (const key of binding.keys)
        if (RESERVED_KEYS.includes(key))
          ctx.addIssue({
            code: 'custom',
            path: ['bindings', action, 'keys'],
            message: `"${action}" binds ${key}, which is reserved (back and focus)`,
          })
    }
  })

/** Action ids sorted by code unit, so the order never depends on locale or insertion. */
function boundActions(profile: InputProfile, isBound: (binding: InputBinding) => boolean): string[] {
  const actions: string[] = []
  for (const [action, binding] of Object.entries(profile.bindings)) if (isBound(binding)) actions.push(action)
  return actions.sort()
}

/** Every action `code` (a `KeyboardEvent.code`) drives in `profile`; none when it is unbound. */
export function actionsForKey(profile: InputProfile, code: string): string[] {
  return boundActions(profile, (binding) => binding.keys.includes(code))
}

/** Every action the standard-mapping pad button `index` drives in `profile`; none when it is unbound. */
export function actionsForPadButton(profile: InputProfile, index: number): string[] {
  return boundActions(profile, (binding) => binding.pad.includes(index))
}

/** Every action `gesture` drives in `profile`; none when it is unbound. */
export function actionsForGesture(profile: InputProfile, gesture: GestureName): string[] {
  return boundActions(profile, (binding) => binding.gesture?.includes(gesture) === true)
}

/** How touch drives play: the on-screen buttons, or swipes and flicks over the whole screen. */
export type TouchMode = 'buttons' | 'swipe'

/**
 * The touch modes a profile offers: `buttons` when an action binds `touch`, `swipe` when one binds a swipe, flick or
 * tap. The camera drag works beside the buttons, so it offers no mode of its own.
 */
export function touchModesFor(profile: InputProfile): TouchMode[] {
  const bindings = Object.values(profile.bindings)
  const isSwipe = (gesture: GestureName): boolean => gesture !== 'camera-drag'
  const modes: TouchMode[] = []
  if (bindings.some((binding) => binding.touch)) modes.push('buttons')
  if (bindings.some((binding) => binding.gesture?.some(isSwipe) === true)) modes.push('swipe')
  return modes
}
