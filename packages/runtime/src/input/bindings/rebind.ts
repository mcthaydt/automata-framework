// Rebinding (M4 spec §4.5, M4-D3, M4-D4), as pure functions over the game's profile and the player's overrides.
// FloorFifty has no rebinding; these rules are the spec's.
import {
  type InputBinding,
  type InputProfile,
  RESERVED_KEYS,
  RESERVED_PAD_BUTTONS,
  STANDARD_PAD_BUTTON_MAX,
} from '../input-profile.schema.js'
import type { BindingOverride, InputSettings } from './input-settings.schema.js'

const sorted = (values: Iterable<string>): string[] => [...values].sort()

/** Why an override cannot apply: it names an input no profile may bind, or a pad button that does not exist. */
function overrideProblem(override: BindingOverride): boolean {
  if (override.keys?.some((key) => RESERVED_KEYS.includes(key)) === true) return true
  return (
    override.pad?.some(
      (button) =>
        !Number.isInteger(button) ||
        button < 0 ||
        button > STANDARD_PAD_BUTTON_MAX ||
        RESERVED_PAD_BUTTONS.includes(button),
    ) === true
  )
}

/**
 * The game's profile with the player's overrides applied (M4 spec §6): an override for an unknown action, one that
 * binds a reserved input, or one with a pad button out of range is dropped and named in `dropped` (sorted), and the
 * defaults stand for it. Overrides saved against another profile are all dropped.
 */
export function applyOverrides(
  defaults: InputProfile,
  saved: InputSettings,
): { readonly profile: InputProfile; readonly dropped: readonly string[] } {
  const actions = Object.keys(saved.overrides)
  if (actions.length === 0) return { profile: defaults, dropped: [] }
  if (saved.profile !== defaults.id) return { profile: defaults, dropped: sorted(actions) }
  const dropped: string[] = []
  const bindings: Record<string, InputBinding> = { ...defaults.bindings }
  for (const [action, override] of Object.entries(saved.overrides)) {
    const binding = defaults.bindings[action]
    if (binding === undefined || overrideProblem(override)) {
      dropped.push(action)
      continue
    }
    bindings[action] = {
      ...binding,
      ...(override.keys === undefined ? {} : { keys: override.keys }),
      ...(override.pad === undefined ? {} : { pad: override.pad }),
    }
  }
  return {
    profile: dropped.length === actions.length ? defaults : { ...defaults, bindings },
    dropped: sorted(dropped),
  }
}
