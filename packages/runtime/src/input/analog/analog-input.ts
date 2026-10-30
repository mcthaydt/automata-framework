// The analog part of `Input` (M4 spec §16.3.4): the touch move stick and the camera drag's pixels. Kept apart from
// `input.manager.ts`, which owns the held sets this reaches through `press` and `lift`.
//
// The touch stick is the left stick while a thumb holds it: its vector goes through the pad's dead zone and
// quantization (`quantizeStick`, M4-D2, M4-D13), and its eight-way directions hold the actions bound to `left-*`
// as sources `touch:stick:<direction>`, so a blur's release of `touch:` sources lets them go too.
//
// The drag is a sum: deltas add up as they arrive, `sample()` (from `poll()`) moves the sum to what `cameraDrag()`
// reads and starts a new one, so a drag between two steps counts once, in the next step, however many steps a frame
// runs.

import { quantizeStick, stickDirections } from '../gamepad/read-pad.js'
import type { DragPointer, DragSink } from '../gestures/camera-drag-tracker.js'
import type { StickDirection } from '../input-profile.schema.js'

/** Where the overlay's move stick goes: a vector clamped to length 1, y positive down, as a pad's axes. */
export interface TouchStickSink {
  set(x: number, y: number): void
  release(): void
}

type Device = 'keyboard' | 'touch'

interface AnalogDeps {
  /** Holds the live actions of `actions` from `source` on `device` (the manager's `press`). */
  press(device: Device, source: string, actions: readonly string[]): void
  lift(source: string): void
  /** The last real input came from `device`. */
  use(device: Device): void
  /** The actions bound to a stick direction in the current bindings. */
  stickActions(direction: StickDirection): readonly string[]
  /** Whether an action live in the current context binds `camera-drag`. */
  dragLive(): boolean
}

export interface AnalogInput {
  readonly touchStick: TouchStickSink
  readonly drag: DragSink
  /**
   * A stick as integers in −127..127 per axis (M4-D2): the active pad's, from its `axes`, except that the touch
   * stick is the left one while it is held.
   */
  stick(side: 'left' | 'right', padAxes: readonly number[]): { readonly x: number; readonly y: number }
  cameraDrag(): number
  /** Once per `poll()`: the drag so far becomes what `cameraDrag()` reads. */
  sample(): void
  /** Lets go of the stick and forgets the drag (blur, hidden, context change, new bindings, dispose). */
  release(): void
}

const CENTRED = { x: 0, y: 0 } as const
const LEFT_DIRECTIONS: readonly StickDirection[] = ['left-up', 'left-down', 'left-left', 'left-right']
const sourceOf = (direction: StickDirection): string => `touch:stick:${direction}`

export function makeAnalogInput(deps: AnalogDeps): AnalogInput {
  let stick: { readonly x: number; readonly y: number } | undefined
  let pending = 0
  let sampled = 0

  const liftDirections = (): void => {
    for (const direction of LEFT_DIRECTIONS) deps.lift(sourceOf(direction))
  }

  return {
    touchStick: {
      set(x, y) {
        deps.use('touch')
        stick = quantizeStick(x, y)
        const pushed = stickDirections('left', x, y)
        for (const direction of LEFT_DIRECTIONS)
          if (pushed.includes(direction))
            deps.press('touch', sourceOf(direction), deps.stickActions(direction))
          else deps.lift(sourceOf(direction))
      },
      release() {
        stick = undefined
        liftDirections()
      },
    },
    drag: {
      drag(dxPx: number, pointer: DragPointer) {
        if (!Number.isFinite(dxPx) || !deps.dragLive()) return
        deps.use(pointer === 'touch' ? 'touch' : 'keyboard')
        pending += dxPx
      },
    },
    stick(side, padAxes) {
      if (side === 'left' && stick !== undefined) return stick
      const first = side === 'left' ? 0 : 2
      const x = padAxes[first] ?? 0
      const y = padAxes[first + 1] ?? 0
      return x === 0 && y === 0 ? CENTRED : quantizeStick(x, y)
    },
    cameraDrag: () => sampled,
    sample() {
      sampled = pending
      pending = 0
    },
    release() {
      stick = undefined
      liftDirections()
      pending = 0
      sampled = 0
    },
  }
}
