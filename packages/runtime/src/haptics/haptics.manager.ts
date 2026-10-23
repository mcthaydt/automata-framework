// Haptics (Owner, 2026-10-18): a controller's rumble, or a phone's buzz. From FloorFifty `systems/haptics.ts` at
// a28dc44, generalised: a game says what each pulse is (`HapticPulse`) rather than FloorFifty's race kinds.
//
// Where a pulse goes:
// - A connected pad with an actuator (the W3C `vibrationActuator`, Chrome and Edge today) gets a `dual-rumble`: the
//   heavy motor for weight, the light one for snap. The first such pad, if there are several.
// - Otherwise a touch screen with `navigator.vibrate` (Android; iOS Safari has none) buzzes, for a pulse that has a
//   phone pattern; a pulse that comes often (a landing) has none, or the phone would hum.
// - Otherwise nothing, and nothing fails.
//
// The player's Vibration setting turns it all off. Haptics are presentation: nothing here reads into the sim.
import { Context } from 'effect'

/** One pulse: a pad's dual-rumble (milliseconds, each motor 0..1), and a phone's buzz in `navigator.vibrate`'s terms. */
export interface HapticPulse {
  readonly duration: number
  readonly strong: number
  readonly weak: number
  /** None: a phone stays still for this pulse. */
  readonly phone?: number | readonly number[] | undefined
}

export interface Haptics {
  /** Rumbles or buzzes, as above. Never throws: feel is never worth an error, and this may run inside a frame. */
  pulse(pulse: HapticPulse): void
  /** Whether this device can do either now: a pad that can rumble, or a touch screen that can buzz. */
  readonly supported: boolean
  /** The player's Vibration setting. */
  setEnabled(enabled: boolean): void
}

export const Haptics: Context.Tag<Haptics, Haptics> = Context.GenericTag<Haptics>(
  '@mcthaydt/automata-runtime/Haptics',
)

interface Actuator {
  playEffect(
    type: 'dual-rumble',
    params: { duration: number; strongMagnitude: number; weakMagnitude: number; startDelay: number },
  ): Promise<unknown>
}
interface PadLike {
  readonly connected: boolean
  readonly index: number
  readonly vibrationActuator?: Actuator | null
}

export interface HapticsOptions {
  readonly getGamepads?: () => readonly (PadLike | null)[]
  /** `navigator.vibrate`, where the browser has it. */
  readonly vibrate?: (pattern: number | number[]) => boolean
  /** Whether this is a touch screen, which a phone's buzz is for. */
  readonly touch: () => boolean
}

export function createHaptics(options: HapticsOptions): Haptics {
  let enabled = true

  const connectedPads = (): PadLike[] => {
    try {
      return (options.getGamepads?.() ?? []).filter((pad): pad is PadLike => pad !== null && pad.connected)
    } catch {
      return []
    }
  }
  /** The pad to rumble: the first connected one whose actuator can play an effect. */
  const rumblePad = (): PadLike | undefined =>
    connectedPads().find((pad) => typeof pad.vibrationActuator?.playEffect === 'function')
  const canBuzz = (): boolean => options.vibrate !== undefined && options.touch()

  return {
    pulse(pulse) {
      if (!enabled) return
      const pad = rumblePad()
      if (pad !== undefined) {
        // An engine may refuse at once (no such effect) or mid-flight (the pad unplugged); both are swallowed.
        try {
          void pad.vibrationActuator
            ?.playEffect('dual-rumble', {
              duration: pulse.duration,
              strongMagnitude: pulse.strong,
              weakMagnitude: pulse.weak,
              startDelay: 0,
            })
            ?.catch(() => undefined)
        } catch {
          // Refused at once.
        }
        return
      }
      // A connected pad without an actuator still means the phone is not in hand.
      if (connectedPads().length > 0) return
      if (pulse.phone === undefined || !canBuzz()) return
      try {
        options.vibrate?.(typeof pulse.phone === 'number' ? pulse.phone : [...pulse.phone])
      } catch {
        // A browser that blocks it outside a gesture says so by throwing on some engines.
      }
    },
    get supported() {
      return rumblePad() !== undefined || canBuzz()
    },
    setEnabled(next) {
      enabled = next
    },
  }
}

/** The browser's haptics: its pads, its `vibrate`, and whether its pointer is a finger. */
export function browserHaptics(target: Window): Haptics {
  const navigator = target.navigator
  return createHaptics({
    ...(typeof navigator.getGamepads === 'function'
      ? { getGamepads: () => navigator.getGamepads() as unknown as readonly (PadLike | null)[] }
      : {}),
    ...(typeof navigator.vibrate === 'function'
      ? { vibrate: (pattern: number | number[]) => navigator.vibrate(pattern) }
      : {}),
    touch: () => target.matchMedia?.('(pointer: coarse)').matches === true,
  })
}
