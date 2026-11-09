// keys(): held keys, on-screen touch buttons and gamepad buttons turned into one command per tick:
// keys by `KeyboardEvent.code`, touch buttons that hold while pressed, everything released when the
// window loses focus. It sends what is held, never a "pressed" edge: the sim compares this tick's command with
// the last one's, so a replay stays a pure function of the command stream.

import type { CommandDef } from '@automata/sim'
import type { z } from 'zod'
import type { AnalogOptions, AnalogReading } from './analog-reading.ts'
import {
  type InputAction,
  type InputMap,
  type InputSource,
  inputMapOf,
  payloadProblem,
  type TouchButton,
} from './input-map-of.ts'
import type { GestureName, StickDirection, TouchMode } from './input-profile.schema.ts'

export type { AnalogOptions, AnalogReading, InputMap, InputSource, TouchButton }

type Payload<Z extends z.ZodType> = Partial<z.input<Z>>

/** By `KeyboardEvent.code`, so the keys sit in the same place on every keyboard layout. */
export type KeyBindings<Z extends z.ZodType> = Readonly<Record<string, Payload<Z>>>

/**
 * Options for `keys`: touch buttons, gamepad buttons, gestures and the stick, the idle payload, required keys
 * and the Controls section's labels.
 */
export interface KeysOptions<Z extends z.ZodType> {
  /** On-screen buttons from the bindings when the player uses touch. Default true. */
  readonly touch?: boolean
  /** Standard-mapping gamepad button index → payload, polled once per tick. */
  readonly pad?: Readonly<Record<number, Payload<Z>>>
  /** Touch gesture → payload: a swipe holds while the finger steers, a flick or a tap lasts one tick. */
  readonly gestures?: Readonly<Partial<Record<GestureName, Payload<Z>>>>
  /** Default `buttons` when the map has touch buttons, else `swipe`. The player's setting overrides it. */
  readonly touchMode?: TouchMode
  /** A stick pushed past the deadzone in a direction (`left-left`, `right-up`, …) → payload. */
  readonly stick?: Readonly<Partial<Record<StickDirection, Payload<Z>>>>
  /** The payload with nothing held. Default: the schema's own defaults (`schema.parse({})`), when it has them. */
  readonly idle?: z.input<Z>
  /**
   * Keys whose actions the game cannot be played without: rebinding never leaves them unbound on a device
   *, and where the touch buttons do not all fit, theirs are the ones that show.
   */
  readonly required?: readonly string[]
  /**
   * Action names for the Controls section, by any of the action's default keys: `{ Space: 'Jump' }`. Default: the
   * command and payload (`move x -1`).
   */
  readonly labels?: Readonly<Record<string, string>>
  /** The sticks and the camera drag, added to the held keys' payload each tick. */
  readonly analog?: AnalogOptions<Z>
}

/**
 * An input map sending `command` once per tick with the payload of what is held: keys by
 * `KeyboardEvent.code`, on-screen touch buttons, gamepad buttons, the stick and gestures, merged over the
 * idle payload. Throws when a binding's payload fails the command's schema, and when a key in `options.required` has
 * no binding.
 */
export function keys<Z extends z.ZodType>(
  command: CommandDef<Z>,
  bindings: KeyBindings<Z>,
  options: KeysOptions<Z> = {},
): InputMap {
  // A binding the schema refuses is a developer error, thrown now rather than dropped every tick.
  const check = (where: string, payload: unknown): void => {
    const why = payloadProblem(command, options.idle, payload)
    if (why !== undefined)
      throw new Error(
        `keys(): ${where} → ${JSON.stringify(payload)} fails the "${command.id}" schema (${why})`,
      )
  }
  for (const [code, payload] of Object.entries(bindings)) check(code, payload)
  for (const code of options.required ?? [])
    if (!Object.hasOwn(bindings, code)) throw new Error(`keys(): required key ${code} is not bound`)
  const pad = Object.entries(options.pad ?? {}).map(([index, payload]) => ({ index: Number(index), payload }))
  for (const { index, payload } of pad) check(`pad button ${index}`, payload)
  const gestures = Object.entries(options.gestures ?? {}) as [GestureName, Payload<Z>][]
  for (const [gesture, payload] of gestures) check(`gesture ${gesture}`, payload)
  const stick = Object.entries(options.stick ?? {}) as [StickDirection, Payload<Z>][]
  for (const [direction, payload] of stick) check(`stick ${direction}`, payload)

  // One action per distinct payload: the keys' payloads in binding order, then any pad, stick or gesture payload
  // no key shares.
  const made: {
    id: string
    payload: unknown
    keys: string[]
    pad: number[]
    stick: StickDirection[]
    gesture: GestureName[]
  }[] = []
  const actionFor = (payload: unknown): (typeof made)[number] => {
    const key = JSON.stringify(payload)
    const found = made.find((action) => JSON.stringify(action.payload) === key)
    if (found !== undefined) return found
    const fresh = { id: `${command.id}-${made.length}`, payload, keys: [], pad: [], stick: [], gesture: [] }
    made.push(fresh)
    return fresh
  }
  for (const [code, payload] of Object.entries(bindings)) actionFor(payload).keys.push(code)
  for (const { index, payload } of pad) actionFor(payload).pad.push(index)
  for (const [direction, payload] of stick) actionFor(payload).stick.push(direction)
  for (const [gesture, payload] of gestures) actionFor(payload).gesture.push(gesture)

  const requiredKeys = new Set(options.required ?? [])
  const actions: InputAction[] = made.map((action) => ({
    ...action,
    label: action.keys.map((code) => options.labels?.[code]).find((label) => label !== undefined),
    required: action.keys.some((code) => requiredKeys.has(code)),
  }))
  return inputMapOf(command, actions, options)
}
