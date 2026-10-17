// keys(): held keys, on-screen touch buttons and gamepad buttons turned into one command per tick (DX spec
// §3.3). Extracted from Emberwick's input (games/emberwick/src/input/keys.ts and devices.ts at the EX.2 move,
// `6d8e5c7`): keys by `KeyboardEvent.code`, touch buttons that hold while pressed, everything released when the
// window loses focus. It sends what is held, never a "pressed" edge: the sim compares this tick's command with
// the last one's, so a replay stays a pure function of the command stream.
import {
  type InputProfile,
  inputProfileSchema,
  makeInput,
  type PresentationBus,
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
  dispose(): void
}

/** Held keys, touch buttons and gamepad buttons, turned into one command per tick (DX spec §3.3). */
export interface InputMap {
  readonly command: CommandDef
  /** Whether the play screen shows touch buttons when the player uses touch. */
  readonly touch: boolean
  readonly touchButtons: readonly TouchButton[]
  /**
   * The bindings as data (M4 spec §2.2): one action per distinct payload, id `<command id>-<n>`, with its keys, its
   * pad buttons and whether it has a touch button. Rebinding swaps the profile and never the command mapping.
   */
  readonly profile: InputProfile
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
  /** The payload with nothing held. Default: the schema's own defaults (`schema.parse({})`), when it has them. */
  readonly idle?: z.input<Z>
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

  // One action per distinct payload: the keys' payloads in binding order, then any pad payload no key shares.
  const actions: { id: string; payload: unknown; keys: string[]; pad: number[] }[] = []
  const actionFor = (payload: unknown): (typeof actions)[number] => {
    const key = JSON.stringify(payload)
    const found = actions.find((action) => JSON.stringify(action.payload) === key)
    if (found !== undefined) return found
    const made = { id: `${command.id}-${actions.length}`, payload, keys: [], pad: [] }
    actions.push(made)
    return made
  }
  for (const [code, payload] of Object.entries(bindings)) actionFor(payload).keys.push(code)
  for (const { index, payload } of pad) actionFor(payload).pad.push(index)

  const touch = options.touch !== false
  const parsedProfile = inputProfileSchema.safeParse({
    id: command.id,
    bindings: Object.fromEntries(
      actions.map((action) => [
        action.id,
        { keys: action.keys, pad: action.pad, touch: touch && action.keys.length > 0 },
      ]),
    ),
  })
  // A reserved key or pad button is a developer error, thrown now (M4-D3, I-j).
  if (!parsedProfile.success)
    throw new Error(`keys(): ${parsedProfile.error.issues.map((issue) => issue.message).join('; ')}`)
  const profile = parsedProfile.data

  const touchButtons: TouchButton[] = actions
    .filter((action) => action.keys.length > 0)
    .map((action) => ({ id: action.id, label: labelFor(action.keys[0] as string), keys: action.keys }))
  const payloadOf = new Map(actions.map((action) => [action.id, action.payload]))

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
    profile,
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
        dispose: () => Effect.runSync(Scope.close(scope, Exit.void)),
      }
    },
  }
}
