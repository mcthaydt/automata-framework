// Rebinding, as pure functions over the game's profile and the player's overrides.
// FloorFifty has no rebinding; these rules are the spec's.
import { ok, type Result, refused } from '../../../shared/lib/result.ts'
import {
  type InputBinding,
  type InputContext,
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
 * The game's profile with the player's overrides applied: an override for an unknown action, one that
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

/** The input a capture caught: a key by its `KeyboardEvent.code`, or a standard-mapping pad button. */
export type Capture = { readonly code: string } | { readonly button: number }

interface ConflictFields {
  readonly action: string
  readonly with: string
}
interface ReservedFields {
  readonly action: string
  readonly input: string
}
interface UnknownFields {
  readonly action: string
}
/** Refused: the input would leave `with`, a required action, with nothing on that device. */
export class RebindConflict extends Error {
  readonly _tag = 'RebindConflict' as const
  readonly action: string
  readonly with: string

  constructor(fields: ConflictFields) {
    super(`'${fields.action}' cannot take that input: '${fields.with}' would be left with nothing`)
    this.name = 'RebindConflict'
    this.action = fields.action
    this.with = fields.with
  }
}
/** Refused: Escape, Tab, pad 8 or pad 16, or a pad button the standard mapping does not have. */
export class RebindReserved extends Error {
  readonly _tag = 'RebindReserved' as const
  readonly action: string
  readonly input: string

  constructor(fields: ReservedFields) {
    super(`'${fields.input}' is kept for the game itself and cannot be bound to '${fields.action}'`)
    this.name = 'RebindReserved'
    this.action = fields.action
    this.input = fields.input
  }
}
/** Refused: the profile has no such action. */
export class RebindUnknown extends Error {
  readonly _tag = 'RebindUnknown' as const
  readonly action: string

  constructor(fields: UnknownFields) {
    super(`There is no action '${fields.action}' to bind`)
    this.name = 'RebindUnknown'
    this.action = fields.action
  }
}
/** Why a rebind was refused, with nothing changed. */
export type RebindError = RebindConflict | RebindReserved | RebindUnknown

interface CaptureFields {
  /** What the capture was waiting for. */
  readonly device: 'keyboard' | 'gamepad'
}
/** The player pressed Escape or pad B while a capture waited: nothing changes. */
export class RebindCancelled extends Error {
  readonly _tag = 'RebindCancelled' as const
  readonly device: 'keyboard' | 'gamepad'

  constructor(fields: CaptureFields) {
    super(`The ${fields.device} capture was cancelled`)
    this.name = 'RebindCancelled'
    this.device = fields.device
  }
}
/** Nothing was pressed for `REBIND_TIMEOUT_MS`: nothing changes. */
export class RebindTimedOut extends Error {
  readonly _tag = 'RebindTimedOut' as const
  readonly device: 'keyboard' | 'gamepad'

  constructor(fields: CaptureFields) {
    super(`Nothing was pressed on the ${fields.device} in time`)
    this.name = 'RebindTimedOut'
    this.device = fields.device
  }
}

const contextOf = (binding: InputBinding): InputContext => binding.context ?? 'play'
/** Two actions compete for an input when they can be live at once. */
const overlaps = (a: InputContext, b: InputContext): boolean => a === b || a === 'any' || b === 'any'
const sameList = <T>(a: readonly T[], b: readonly T[]): boolean =>
  a.length === b.length && a.every((value, index) => value === b[index])

/** Only what differs from the defaults, per action and field, so a game update keeps the player's other bindings. */
function overridesFrom(
  defaults: InputProfile,
  bindings: Readonly<Record<string, InputBinding>>,
): Record<string, BindingOverride> {
  const result: Record<string, BindingOverride> = {}
  for (const action of Object.keys(defaults.bindings).sort()) {
    const shipped = defaults.bindings[action] as InputBinding
    const now = bindings[action] ?? shipped
    const keys = sameList(now.keys, shipped.keys) ? undefined : now.keys
    const pad = sameList(now.pad, shipped.pad) ? undefined : now.pad
    if (keys !== undefined || pad !== undefined)
      result[action] = { ...(keys === undefined ? {} : { keys }), ...(pad === undefined ? {} : { pad }) }
  }
  return result
}

/**
 * Binds `capture` to `action` on `device`: it becomes the action's only input there and
 * leaves every other action live in an overlapping context. Refused, with nothing changed, when the input is
 * reserved or when it would leave a `required` action with nothing on that device. The result is the overrides
 * over `defaults` for the whole profile, ready to save.
 */
export function rebindProfile(
  defaults: InputProfile,
  current: InputProfile,
  action: string,
  device: 'keyboard' | 'gamepad',
  capture: Capture,
): Result<Record<string, BindingOverride>, RebindError> {
  const target = current.bindings[action]
  if (target === undefined) return refused(new RebindUnknown({ action }))
  const field = device === 'keyboard' ? 'keys' : 'pad'
  let input: string | number
  if ('code' in capture) {
    if (RESERVED_KEYS.includes(capture.code))
      return refused(new RebindReserved({ action, input: capture.code }))
    input = capture.code
  } else {
    const { button } = capture
    if (
      !Number.isInteger(button) ||
      button < 0 ||
      button > STANDARD_PAD_BUTTON_MAX ||
      RESERVED_PAD_BUTTONS.includes(button)
    )
      return refused(new RebindReserved({ action, input: `pad ${button}` }))
    input = button
  }

  const bindings: Record<string, InputBinding> = { ...current.bindings }
  for (const other of Object.keys(current.bindings).sort()) {
    if (other === action) continue
    const binding = current.bindings[other] as InputBinding
    const inputs = binding[field] as readonly (string | number)[]
    if (!inputs.includes(input) || !overlaps(contextOf(binding), contextOf(target))) continue
    const left = inputs.filter((value) => value !== input)
    if (binding.required === true && left.length === 0)
      return refused(new RebindConflict({ action, with: other }))
    bindings[other] = { ...binding, [field]: left }
  }
  bindings[action] = { ...target, [field]: [input] }
  return ok(overridesFrom(defaults, bindings))
}
