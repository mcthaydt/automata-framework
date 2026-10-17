import { z } from 'zod'

/**
 * The highest button index of the W3C Gamepad standard mapping (0 = bottom face button … 16 = home). Only the
 * standard mapping is bound (DX spec §3.3); a pad without it is the device layer's to normalize.
 */
export const STANDARD_PAD_BUTTON_MAX = 16

/** What drives one action: keys by `KeyboardEvent.code` (layout independent), pad buttons, an on-screen button. */
export interface InputBinding {
  readonly keys: readonly string[]
  readonly pad: readonly number[]
  readonly touch: boolean
}

/**
 * A named set of bindings, one per game action (PRODUCT spec §2 F1). It is data: a settings screen rebinds a
 * copy and saves it in the game's `SettingsDef`; M4's input service reads it. Action ids are the game's own.
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
      }
    >
  >
}

const bindingSchema = z.object({
  keys: z.array(z.string().min(1)).default([]),
  pad: z.array(z.number().int().min(0).max(STANDARD_PAD_BUTTON_MAX)).default([]),
  touch: z.boolean().default(false),
})

/** Validates an input profile, filling left-out binding fields with "unbound". */
export const inputProfileSchema: z.ZodType<InputProfile, InputProfileInput> = z.object({
  id: z.string().min(1),
  bindings: z.record(z.string().min(1), bindingSchema),
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
