// One pad's state, from FloorFifty `apps/client/src/managers/gamepad-source.ts` at `ac72660`
// (`readPad`, lines 31–96): a radial deadzone, triggers pressed from half travel, and menu directions from the
// D-pad or the left stick along its stronger axis. FloorFifty's race intents (fast-fall, reset, hops) stay there.
import type { StickDirection } from '../input-profile.schema.js'

/** The parts of a `Gamepad` read here, so tests and replays can pass plain objects. */
export interface PadLike {
  readonly id: string
  readonly index: number
  readonly connected: boolean
  readonly mapping: string
  readonly axes: readonly number[]
  readonly buttons: readonly { readonly pressed: boolean; readonly value: number }[]
}

export type PadDirection = 'up' | 'down' | 'left' | 'right'

export interface PadReading {
  /** Buttons pressed, a trigger counting from `TRIGGER_PRESSED`. */
  readonly buttons: ReadonlySet<number>
  /** Each stick's directions past the deadzone, eight-way. */
  readonly sticks: ReadonlySet<StickDirection>
  /** Menu directions: the D-pad, or the left stick along its stronger axis only. */
  readonly nav: ReadonlySet<PadDirection>
}

/** Radial, so a stick resting slightly off-centre on both axes stays still (FloorFifty line 31). */
export const DEADZONE = 0.25
export const TRIGGER_PRESSED = 0.5
/**
 * Past the deadzone, an axis counts when it carries at least sin(22.5°) of the push: the stick reads as eight
 * sectors, so (0.2, 0.2) is a diagonal and (0.3, 0.01) is plain right.
 */
const AXIS_SHARE = Math.sin(Math.PI / 8)
const DPAD: readonly [number, PadDirection][] = [
  [12, 'up'],
  [13, 'down'],
  [14, 'left'],
  [15, 'right'],
]

const isPressed = (button: { readonly pressed: boolean; readonly value: number } | undefined): boolean =>
  button !== undefined && (button.pressed || button.value >= TRIGGER_PRESSED)

/** A stick's push, zeroed inside the radial deadzone. */
function push(pad: PadLike, first: number): { x: number; y: number; radius: number } {
  const x = pad.axes[first] ?? 0
  const y = pad.axes[first + 1] ?? 0
  const radius = Math.hypot(x, y)
  return radius < DEADZONE ? { x: 0, y: 0, radius: 0 } : { x, y, radius }
}

export function readPad(pad: PadLike): PadReading {
  const buttons = new Set<number>()
  pad.buttons.forEach((button, index) => {
    if (isPressed(button)) buttons.add(index)
  })

  const sticks = new Set<StickDirection>()
  for (const side of ['left', 'right'] as const) {
    const first = side === 'left' ? 0 : 2
    for (const direction of stickDirections(side, pad.axes[first] ?? 0, pad.axes[first + 1] ?? 0))
      sticks.add(direction)
  }

  // The stick walks a menu exactly as the D-pad does: one step along its stronger axis, so a diagonal is one
  // step rather than two.
  const nav = new Set<PadDirection>()
  for (const [button, direction] of DPAD) if (buttons.has(button)) nav.add(direction)
  const left = push(pad, 0)
  if (left.radius > 0) {
    if (Math.abs(left.y) > Math.abs(left.x)) nav.add(left.y < 0 ? 'up' : 'down')
    else nav.add(left.x < 0 ? 'left' : 'right')
  }
  return { buttons, sticks, nav }
}

/**
 * A stick's directions past the radial deadzone, eight-way: an axis counts when it carries at least `AXIS_SHARE` of
 * the push. The pad's sticks and the touch stick share it, so the same push holds the same actions.
 */
export function stickDirections(side: 'left' | 'right', x: number, y: number): StickDirection[] {
  const radius = Math.hypot(x, y)
  if (radius < DEADZONE) return []
  const directions: StickDirection[] = []
  if (y <= -AXIS_SHARE * radius) directions.push(`${side}-up`)
  if (y >= AXIS_SHARE * radius) directions.push(`${side}-down`)
  if (x <= -AXIS_SHARE * radius) directions.push(`${side}-left`)
  if (x >= AXIS_SHARE * radius) directions.push(`${side}-right`)
  return directions
}

/**
 * A stick as integers in −127..127 per axis (M4-D2): small and exact in every engine, centred inside the radial
 * deadzone. Halves round away from zero, so a push left reads as the same size as the same push right.
 */
export function quantizeStick(x: number, y: number): { readonly x: number; readonly y: number } {
  if (Math.hypot(x, y) < DEADZONE) return CENTRED
  return { x: quantize(x), y: quantize(y) }
}

const CENTRED = { x: 0, y: 0 } as const
const quantize = (value: number): number => {
  const size = Math.round(Math.min(1, Math.abs(value)) * 127)
  return size === 0 ? 0 : Math.sign(value) * size
}
