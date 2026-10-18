// keys(): held keys, on-screen touch buttons and gamepad buttons turned into one command per tick (DX spec
// §3.3). Extracted from Emberwick's input (games/emberwick/src/input/keys.ts and devices.ts at the EX.2 move,
// `6d8e5c7`): keys by `KeyboardEvent.code`, touch buttons that hold while pressed, everything released when the
// window loses focus. It sends what is held, never a "pressed" edge: the sim compares this tick's command with
// the last one's, so a replay stays a pure function of the command stream.
import {
  type GestureName,
  type GestureSink,
  type InputProfile,
  inputProfileSchema,
  makeInput,
  type PresentationBus,
  type StickDirection,
  type TouchMode,
  touchModesFor,
} from '@mcthaydt/automata-runtime'
import type { Command, CommandDef } from '@mcthaydt/automata-sim'
import { Effect, Exit, Scope } from 'effect'
import type { z } from 'zod'

/** One on-screen touch button: every key bound to the same payload shares it. */
export interface TouchButton {
  readonly id: string
  readonly label: string
  readonly keys: readonly string[]
}

/** The input map attached to a window for one play session. */
export interface InputSource {
  /** This tick's command, if any: one per tick, never an edge (DX spec §3.3). */
  commands(tick: number): readonly Command[]
  /** A touch button pressed or released (its `TouchButton.id`). */
  hold(buttonId: string): void
  release(buttonId: string): void
  /** Gestures from a `SwipeTracker` (M4.3): held swipes and one-tick flicks and taps. */
  readonly gesture: GestureSink
  dispose(): void
}

/** Held keys, touch buttons and gamepad buttons, turned into one command per tick (DX spec §3.3). */
export interface InputMap {
  readonly command: CommandDef
  /** Whether the play screen shows touch buttons when the player uses touch. */
  readonly touch: boolean
  readonly touchButtons: readonly TouchButton[]
  /** How the play screen takes touch: its buttons, or swipes over the whole screen (M4 spec §4.4). */
  readonly touchMode: TouchMode
  /**
   * The bindings as data (M4 spec §2.2): one action per distinct payload, id `<command id>-<n>`, with its keys, its
   * pad buttons and whether it has a touch button. Rebinding swaps the profile and never the command mapping.
   */
  readonly profile: InputProfile
  /** Each action's name, as the Settings screen's Controls section lists it (M4.4). */
  readonly labels: Readonly<Record<string, string>>
  /** Pure: the one command for the held actions, merged in iteration order (a later action wins per field). */
  toCommand(held: Iterable<string>, tick: number): readonly Command[]
  attach(target: Window): InputSource
}

type Payload<Z extends z.ZodType> = Partial<z.input<Z>>

/** By `KeyboardEvent.code`, so the keys sit in the same place on every keyboard layout. */
export type KeyBindings<Z extends z.ZodType> = Readonly<Record<string, Payload<Z>>>

export interface KeysOptions<Z extends z.ZodType> {
  /** On-screen buttons from the bindings when the player uses touch. Default true. */
  readonly touch?: boolean
  /** Standard-mapping gamepad button index → payload, polled once per tick. */
  readonly pad?: Readonly<Record<number, Payload<Z>>>
  /** Touch gesture → payload (M4.3): a swipe holds while the finger steers, a flick or a tap lasts one tick. */
  readonly gestures?: Readonly<Partial<Record<GestureName, Payload<Z>>>>
  /** Default `buttons` when the map has touch buttons, else `swipe`. The player's setting is M4.4's. */
  readonly touchMode?: TouchMode
  /** A stick pushed past the deadzone in a direction (`left-left`, `right-up`, …) → payload (M4.2). */
  readonly stick?: Readonly<Partial<Record<StickDirection, Payload<Z>>>>
  /** The payload with nothing held. Default: the schema's own defaults (`schema.parse({})`), when it has them. */
  readonly idle?: z.input<Z>
  /**
   * Action names for the Controls section, by any of the action's default keys: `{ Space: 'Jump' }`. Default: the
   * command and payload (`move x -1`).
   */
  readonly labels?: Readonly<Record<string, string>>
}

const KEY_LABELS: Readonly<Record<string, string>> = {
  ArrowLeft: '←',
  ArrowRight: '→',
  ArrowUp: '↑',
  ArrowDown: '↓',
}

/** `KeyA` → `A`, `Digit1` → `1`, an arrow → its arrow, anything else as named. */
const labelFor = (code: string): string => KEY_LABELS[code] ?? code.replace(/^(Key|Digit)/, '')

/** `attach` builds an Input of its own; nothing reads its facts. */
const SILENT_BUS: PresentationBus = { publish: () => {}, subscribe: () => () => {} }

const asRecord = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : {}

export function keys<Z extends z.ZodType>(
  command: CommandDef<Z>,
  bindings: KeyBindings<Z>,
  options: KeysOptions<Z> = {},
): InputMap {
  const schema = command.schema
  const idleParse = schema.safeParse(options.idle ?? {})
  // What every payload is merged over: the idle payload, or nothing when the schema has no idle state.
  const base = idleParse.success ? asRecord(idleParse.data) : asRecord(options.idle)

  // A binding the schema refuses is a developer error, thrown now rather than dropped every tick (DX spec §6).
  const check = (where: string, payload: unknown): void => {
    const parsed = schema.safeParse({ ...base, ...asRecord(payload) })
    if (!parsed.success) {
      const why = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ')
      throw new Error(
        `keys(): ${where} → ${JSON.stringify(payload)} fails the "${command.id}" schema (${why})`,
      )
    }
  }
  for (const [code, payload] of Object.entries(bindings)) check(code, payload)
  const pad = Object.entries(options.pad ?? {}).map(([index, payload]) => ({ index: Number(index), payload }))
  for (const { index, payload } of pad) check(`pad button ${index}`, payload)
  const gestures = Object.entries(options.gestures ?? {}) as [GestureName, Payload<Z>][]
  for (const [gesture, payload] of gestures) check(`gesture ${gesture}`, payload)
  const stick = Object.entries(options.stick ?? {}) as [StickDirection, Payload<Z>][]
  for (const [direction, payload] of stick) check(`stick ${direction}`, payload)

  // One action per distinct payload: the keys' payloads in binding order, then any pad, stick or gesture payload
  // no key shares.
  const actions: {
    id: string
    payload: unknown
    keys: string[]
    pad: number[]
    stick: StickDirection[]
    gesture: GestureName[]
  }[] = []
  const actionFor = (payload: unknown): (typeof actions)[number] => {
    const key = JSON.stringify(payload)
    const found = actions.find((action) => JSON.stringify(action.payload) === key)
    if (found !== undefined) return found
    const made = { id: `${command.id}-${actions.length}`, payload, keys: [], pad: [], stick: [], gesture: [] }
    actions.push(made)
    return made
  }
  for (const [code, payload] of Object.entries(bindings)) actionFor(payload).keys.push(code)
  for (const { index, payload } of pad) actionFor(payload).pad.push(index)
  for (const [direction, payload] of stick) actionFor(payload).stick.push(direction)
  for (const [gesture, payload] of gestures) actionFor(payload).gesture.push(gesture)

  const touch = options.touch !== false
  const parsedProfile = inputProfileSchema.safeParse({
    id: command.id,
    bindings: Object.fromEntries(
      actions.map((action) => [
        action.id,
        {
          keys: action.keys,
          pad: action.pad,
          ...(action.stick.length > 0 ? { stick: action.stick } : {}),
          touch: touch && action.keys.length > 0,
          ...(action.gesture.length > 0 ? { gesture: action.gesture } : {}),
        },
      ]),
    ),
  })
  // A reserved key or pad button is a developer error, thrown now (M4-D3, I-j).
  if (!parsedProfile.success)
    throw new Error(`keys(): ${parsedProfile.error.issues.map((issue) => issue.message).join('; ')}`)
  const profile = parsedProfile.data
  const modes = touchModesFor(profile)
  if (options.touchMode !== undefined && !modes.includes(options.touchMode))
    throw new Error(
      `keys(): touchMode "${options.touchMode}" needs ${options.touchMode === 'swipe' ? 'a gesture' : 'a touch button'}`,
    )
  const touchMode: TouchMode =
    options.touchMode ?? (modes.includes('buttons') || !modes.includes('swipe') ? 'buttons' : 'swipe')

  const touchButtons: TouchButton[] = actions
    .filter((action) => action.keys.length > 0)
    .map((action) => ({ id: action.id, label: labelFor(action.keys[0] as string), keys: action.keys }))
  const payloadOf = new Map(actions.map((action) => [action.id, action.payload]))
  const labels = Object.fromEntries(
    actions.map((action) => {
      const named = action.keys.map((code) => options.labels?.[code]).find((label) => label !== undefined)
      const fields = Object.entries(asRecord(action.payload)).map(
        ([field, value]) => `${field} ${String(value)}`,
      )
      return [action.id, named ?? [command.id, ...fields].join(' ')]
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

  return {
    command,
    touch,
    touchButtons,
    touchMode,
    profile,
    labels,
    toCommand,
    attach(target) {
      // The Input service over `target`, in a scope of its own that `dispose` closes. Nothing here listens to
      // its facts, so it publishes to a bus no one reads.
      const scope = Effect.runSync(Scope.make())
      const input = Effect.runSync(makeInput({ target, profile, bus: SILENT_BUS }).pipe(Scope.extend(scope)))
      return {
        commands(tick) {
          input.poll()
          return toCommand(input.held(), tick)
        },
        hold: (buttonId) => input.hold(buttonId),
        release: (buttonId) => input.release(buttonId),
        gesture: input.gesture,
        dispose: () => Effect.runSync(Scope.close(scope, Exit.void)),
      }
    },
  }
}
