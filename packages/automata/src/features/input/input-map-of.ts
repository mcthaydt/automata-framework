// inputMapOf(): a list of actions turned into one InputMap. `keys()` builds its actions from key bindings (one per
// distinct payload, ids `<command>-<n>`) and `controlsFrom()` from `content/controls.toml` (the file's own ids and
// labels); both end here, so a map plays the same whichever way it was written.

import type { Command, CommandDef } from '@automata/sim'
import type { z } from 'zod'
import type { PresentationBus } from '../../shared/runtime/presentation/presentation-bus.manager.ts'
import { keyLabel } from '../../shared/ui/prompts/prompt-label.ts'
import { CAMERA_SETTINGS_DEFAULT } from './analog/camera-settings.schema.ts'
import { type AnalogOptions, type AnalogReading, analogReading } from './analog-reading.ts'
import type { GestureSink } from './gestures/swipe-tracker.ts'
import { createInput } from './input.manager.ts'
import {
  type GestureName,
  type InputProfile,
  inputProfileSchema,
  type StickDirection,
  type TouchMode,
  touchModesFor,
} from './input-profile.schema.ts'

/** One on-screen touch button: every key bound to the same payload shares it. */
export interface TouchButton {
  readonly id: string
  readonly label: string
  readonly keys: readonly string[]
  /** Which lower corner's group it sits in. Default `start`; a game moves buttons to `end` itself. */
  readonly side?: 'start' | 'end' | undefined
  /** The game cannot be played without it: where the touch buttons do not all fit, only these show. */
  readonly required?: boolean | undefined
}

/** The input map attached to a window for one play session. */
export interface InputSource {
  /** This tick's command, if any: one per tick, never an edge. */
  commands(tick: number): readonly Command[]
  /** A touch button pressed or released (its `TouchButton.id`). */
  hold(buttonId: string): void
  release(buttonId: string): void
  /** Gestures from a `SwipeTracker`: held swipes and one-tick flicks and taps. */
  readonly gesture: GestureSink
  dispose(): void
}

/** Held keys, touch buttons and gamepad buttons, turned into one command per tick. */
export interface InputMap {
  readonly command: CommandDef
  /** Whether the play screen shows touch buttons when the player uses touch. */
  readonly touch: boolean
  readonly touchButtons: readonly TouchButton[]
  /** How the play screen takes touch: its buttons, or swipes over the whole screen. */
  readonly touchMode: TouchMode
  /**
   * The bindings as data: one action per distinct payload, id `<command id>-<n>`, with its keys, its
   * pad buttons and whether it has a touch button. Rebinding swaps the profile and never the command mapping.
   */
  readonly profile: InputProfile
  /** Each action's name, as the Settings screen's Controls section lists it. */
  readonly labels: Readonly<Record<string, string>>
  /** Whether the play screen shows the touch stick (the `analog.touchStick` option). */
  readonly touchStick: boolean
  /**
   * Pure: the one command for the held actions, merged in iteration order (a later action wins per field). With an
   * `analog` option, `reading` adds the sticks and the drag; without one it is ignored.
   */
  toCommand(held: Iterable<string>, tick: number, reading?: AnalogReading): readonly Command[]
  attach(target: Window): InputSource
}

/** One action: what it sends while held, and every way to do it. */
export interface InputAction {
  readonly id: string
  readonly payload: unknown
  readonly keys: readonly string[]
  readonly pad: readonly number[]
  readonly stick: readonly StickDirection[]
  readonly gesture: readonly GestureName[]
  /** Its name in the Controls section. Default: the command and payload (`move x -1`). */
  readonly label?: string | undefined
  /** Whether it has an on-screen button (when it has a key). Default yes. */
  readonly touch?: boolean | undefined
  /** The game cannot be played without it. */
  readonly required?: boolean | undefined
}

/** The options of an input map that are not about one action. */
export interface InputMapOptions<Z extends z.ZodType> {
  /** On-screen buttons when the player uses touch. Default true. */
  readonly touch?: boolean | undefined
  readonly touchMode?: TouchMode | undefined
  readonly idle?: z.input<Z> | undefined
  readonly analog?: AnalogOptions<Z> | undefined
}

/** `attach` builds an Input of its own; nothing reads its facts. */
const SILENT_BUS: PresentationBus = { publish: () => {}, subscribe: () => () => {} }

export const asRecord = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : {}

/** What every payload is merged over: the idle payload, or nothing when the schema has no idle state. */
export function basePayload(command: CommandDef, idle: unknown): Record<string, unknown> {
  const parsed = command.schema.safeParse(idle ?? {})
  return parsed.success ? asRecord(parsed.data) : asRecord(idle)
}

/** The schema's sentence when `payload` (over the idle payload) is not one the command takes; undefined when it is. */
export function payloadProblem(command: CommandDef, idle: unknown, payload: unknown): string | undefined {
  const parsed = command.schema.safeParse({ ...basePayload(command, idle), ...asRecord(payload) })
  if (parsed.success) return undefined
  return parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ')
}

/**
 * The input map for `actions`: each action's payload is merged over the idle payload in iteration order while held.
 * The caller has checked the payloads (`payloadProblem`); a reserved key or pad button still throws here.
 */
export function inputMapOf<Z extends z.ZodType>(
  command: CommandDef<Z>,
  actions: readonly InputAction[],
  options: InputMapOptions<Z> = {},
): InputMap {
  const schema = command.schema
  const base = basePayload(command, options.idle)
  const touch = options.touch !== false
  const analog = options.analog
  const hasButton = (action: InputAction): boolean => action.keys.length > 0 && action.touch !== false
  const parsedProfile = inputProfileSchema.safeParse({
    id: command.id,
    bindings: Object.fromEntries([
      ...actions.map((action) => [
        action.id,
        {
          keys: action.keys,
          pad: action.pad,
          ...(action.stick.length > 0 ? { stick: action.stick } : {}),
          touch: touch && hasButton(action),
          ...(action.gesture.length > 0 ? { gesture: action.gesture } : {}),
          ...(action.required === true ? { required: true } : {}),
        },
      ]),
      // Binding the camera drag is what turns it on; it has no key and no button.
      ...(analog?.drag === true
        ? [[`${command.id}-drag`, { keys: [], pad: [], touch: false, gesture: ['camera-drag'] }]]
        : []),
    ]),
  })
  // A reserved key or pad button is a developer error, thrown now.
  if (!parsedProfile.success)
    throw new Error(`keys(): ${parsedProfile.error.issues.map((issue) => issue.message).join('; ')}`)
  const profile = parsedProfile.data
  const modes = touchModesFor(profile)
  if (options.touchMode !== undefined && !modes.includes(options.touchMode))
    throw new Error(
      `keys(): touchMode "${options.touchMode}" needs ${options.touchMode === 'swipe' ? 'a swipe, flick or tap' : 'a touch button'}`,
    )
  const touchMode: TouchMode =
    options.touchMode ?? (modes.includes('buttons') || !modes.includes('swipe') ? 'buttons' : 'swipe')

  const touchButtons: TouchButton[] = actions.filter(hasButton).map((action) => ({
    id: action.id,
    label: keyLabel(action.keys[0] as string),
    keys: action.keys,
    ...(action.required === true ? { required: true } : {}),
  }))
  const payloadOf = new Map(actions.map((action) => [action.id, action.payload]))
  const labels = Object.fromEntries(
    actions.map((action) => {
      const fields = Object.entries(asRecord(action.payload)).map(
        ([field, value]) => `${field} ${String(value)}`,
      )
      return [action.id, action.label ?? [command.id, ...fields].join(' ')]
    }),
  )

  /** The parsed payload for payloads merged in order over the idle payload; undefined when the schema refuses it. */
  const merge = (payloads: readonly unknown[]): unknown => {
    const parsed = schema.safeParse(Object.assign({}, base, ...payloads.map(asRecord)))
    return parsed.success ? parsed.data : undefined
  }
  const asCommands = (payload: unknown, tick: number): readonly Command[] =>
    payload === undefined ? [] : [{ tick, source: 0, seq: tick, type: command.id, payload }]

  // The parsed payload for the last held list, so a tick with nothing new parses nothing.
  let cachedFor: string | undefined
  let cached: unknown
  const toCommand = (held: Iterable<string>, tick: number): readonly Command[] => {
    const known: string[] = []
    for (const action of held) if (payloadOf.has(action)) known.push(action)
    const key = known.join('|')
    if (key !== cachedFor) {
      cachedFor = key
      cached = merge(known.map((action) => payloadOf.get(action)))
    }
    return asCommands(cached, tick)
  }
  const toCommandWith = (
    held: Iterable<string>,
    tick: number,
    reading?: AnalogReading,
  ): readonly Command[] => {
    if (analog === undefined || reading === undefined) return toCommand(held, tick)
    const known: string[] = []
    for (const action of held) if (payloadOf.has(action)) known.push(action)
    const heldPayload = merge(known.map((action) => payloadOf.get(action)))
    if (heldPayload === undefined) return []
    // Fresh every tick, never cached. A refused merge (a NaN, a float) drops the analog part, not the held keys.
    const parsed = schema.safeParse({
      ...asRecord(heldPayload),
      ...asRecord(analog.read(reading, heldPayload as z.output<Z>)),
    })
    return asCommands(parsed.success ? parsed.data : heldPayload, tick)
  }

  return {
    command,
    touch,
    touchButtons,
    touchMode,
    profile,
    labels,
    touchStick: analog?.touchStick === true,
    toCommand: toCommandWith,
    attach(target) {
      // The Input service over `target`, which `dispose` takes down. Nothing here listens to
      // its facts, so it publishes to a bus no one reads.
      const input = createInput({ target, profile, bus: SILENT_BUS })
      return {
        commands(tick) {
          input.poll()
          return toCommandWith(input.held(), tick, analogReading(input, CAMERA_SETTINGS_DEFAULT))
        },
        hold: (buttonId) => input.hold(buttonId),
        release: (buttonId) => input.release(buttonId),
        gesture: input.gesture,
        dispose: () => input.dispose(),
      }
    },
  }
}
