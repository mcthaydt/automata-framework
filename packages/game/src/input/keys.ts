// keys(): held keys, on-screen touch buttons and gamepad buttons turned into one command per tick (DX spec
// §3.3). Extracted from Emberwick's input (games/emberwick/src/input/keys.ts and devices.ts at the EX.2 move,
// `6d8e5c7`): keys by `KeyboardEvent.code`, touch buttons that hold while pressed, everything released when the
// window loses focus. It sends what is held, never a "pressed" edge: the sim compares this tick's command with
// the last one's, so a replay stays a pure function of the command stream.
import type { Command, CommandDef } from '@mcthaydt/automata-sim'
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

  // One touch button per distinct payload, in binding order.
  const groups = new Map<string, string[]>()
  for (const [code, payload] of Object.entries(bindings)) {
    const key = JSON.stringify(payload)
    groups.set(key, [...(groups.get(key) ?? []), code])
  }
  const touchButtons: TouchButton[] = [...groups.values()].map((codes, index) => ({
    id: `touch-${index}`,
    label: labelFor(codes[0] as string),
    keys: codes,
  }))
  const touchPayload = new Map(touchButtons.map((button) => [button.id, bindings[button.keys[0] as string]]))

  return {
    command,
    touch: options.touch !== false,
    touchButtons,
    attach(target) {
      // Every source held right now (`key:<code>`, `touch:<id>`, `pad:<index>`), in the order it was pressed:
      // merging in this order lets the later press win per field.
      const held: string[] = []
      const payloads = new Map<string, unknown>()
      const down = (source: string, payload: unknown): void => {
        if (payloads.has(source)) return
        held.push(source)
        payloads.set(source, payload)
      }
      const up = (source: string): void => {
        if (!payloads.delete(source)) return
        held.splice(held.indexOf(source), 1)
      }
      const releaseAll = (): void => {
        held.length = 0
        payloads.clear()
      }

      const onKeyDown = (event: KeyboardEvent): void => {
        const payload = bindings[event.code]
        if (payload === undefined) return
        // Keep Space and the arrows from scrolling the page.
        event.preventDefault()
        down(`key:${event.code}`, payload)
      }
      const onKeyUp = (event: KeyboardEvent): void => up(`key:${event.code}`)
      target.addEventListener('keydown', onKeyDown)
      target.addEventListener('keyup', onKeyUp)
      target.addEventListener('blur', releaseAll)

      const pollPad = (): void => {
        if (pad.length === 0) return
        const pads = target.navigator.getGamepads?.() ?? []
        const standard = [...pads].filter((candidate) => candidate?.mapping === 'standard')
        for (const { index, payload } of pad) {
          const pressed = standard.some((candidate) => candidate?.buttons[index]?.pressed === true)
          if (pressed) down(`pad:${index}`, payload)
          else up(`pad:${index}`)
        }
      }

      // The parsed payload for the current held set, so a tick with nothing new parses nothing.
      let cachedFor = ''
      let cached: unknown
      const payloadNow = (): unknown => {
        const key = held.join('|')
        if (key === cachedFor && cached !== undefined) return cached
        const merged = Object.assign({}, base, ...held.map((source) => asRecord(payloads.get(source))))
        const parsed = schema.safeParse(merged)
        cachedFor = key
        cached = parsed.success ? parsed.data : undefined
        return cached
      }

      return {
        commands(tick) {
          pollPad()
          const payload = payloadNow()
          if (payload === undefined) return []
          return [{ tick, source: 0, seq: tick, type: command.id, payload }]
        },
        hold(buttonId) {
          const payload = touchPayload.get(buttonId)
          if (payload !== undefined) down(`touch:${buttonId}`, payload)
        },
        release(buttonId) {
          up(`touch:${buttonId}`)
        },
        dispose() {
          target.removeEventListener('keydown', onKeyDown)
          target.removeEventListener('keyup', onKeyUp)
          target.removeEventListener('blur', releaseAll)
          releaseAll()
        },
      }
    },
  }
}
