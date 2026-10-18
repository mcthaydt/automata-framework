// A controller for a real built game (M4 spec §4.14), from FloorFifty `tests/e2e/support/fake-gamepad.ts` at
// `a28dc44`. An init script replaces `navigator.getGamepads` with one standard pad whose state lives on the page;
// the helpers write it. Nothing reaches past the Gamepad API: the game's own poll, pad reading, focus navigation and
// screens run as they do for a real pad. Connecting and unplugging dispatch `gamepadconnected` and
// `gamepaddisconnected`, as a browser does.
//
// Every change waits for animation frames, never a sleep, so the per-frame poll has read it before the helper
// returns: three after most changes, one for the press inside a tap or a step. A slow WebKit frame is long, and
// three of them under load outlasted the 400 ms menu repeat delay in FloorFifty, turning a tap into a repeat.
//
// AF difference: the init script runs in every frame, so under the fake Ruken host the pad is the game frame's.
// `in(frame)` points the helpers there; the page's own frame is the default.
import type { Frame, Page } from '@playwright/test'

/** The standard mapping's buttons by name: south (A on an Xbox pad) is 0, Start is 9, the D-pad 12 to 15. */
export const PAD_BUTTONS = {
  south: 0,
  east: 1,
  west: 2,
  north: 3,
  lb: 4,
  rb: 5,
  lt: 6,
  rt: 7,
  select: 8,
  start: 9,
  ls: 10,
  rs: 11,
  dpadUp: 12,
  dpadDown: 13,
  dpadLeft: 14,
  dpadRight: 15,
  home: 16,
} as const
/** A standard-mapping button by name. */
export type PadButton = keyof typeof PAD_BUTTONS
/** Whether a direction is held on the D-pad or the left stick. */
export type PadMode = 'dpad' | 'stick'
/** A direction on the D-pad or the stick. */
export type Direction = 'up' | 'down' | 'left' | 'right'

type PadState = { buttons: number[]; axes: number[]; connected: boolean; timestamp: number; mapping: string }
/** The page-side pad and the `Gamepad`-shaped reading of it. */
type PadHost = { __afPad: PadState; __afPadSnapshot: () => unknown }
/** One change to the page-side pad; plain data, so it crosses into the page as JSON. */
type PadPatch = { connected?: boolean; button?: [number, number]; stick?: [number, number] }

const DPAD: Record<Direction, PadButton> = {
  up: 'dpadUp',
  down: 'dpadDown',
  left: 'dpadLeft',
  right: 'dpadRight',
}
const STICK: Record<Direction, [number, number]> = {
  up: [0, -0.9],
  down: [0, 0.9],
  left: [-0.9, 0],
  right: [0.9, 0],
}

/** How the fake pad reports itself: its mapping and its id (the id picks the prompts' glyphs). */
export interface FakePadOptions {
  /** `''` for a pad the browser does not map to the standard layout. Default `standard`. */
  readonly mapping?: '' | 'standard'
  readonly id?: string
}

/** One standard controller in a real browser, driven through the Gamepad API the game itself reads. */
export class FakePad {
  private constructor(private target: Page | Frame) {}

  /** Installs the fake before any game script runs, in every frame; call before `goto`. The pad starts unplugged. */
  static async install(page: Page, options: FakePadOptions = {}): Promise<FakePad> {
    await page.addInitScript(
      ({ mapping, id }) => {
        const state: PadState = {
          buttons: Array(17).fill(0),
          axes: [0, 0, 0, 0],
          connected: false,
          timestamp: 0,
          mapping,
        }
        const snapshot = () => ({
          id,
          index: 0,
          connected: true,
          mapping: state.mapping,
          timestamp: state.timestamp,
          axes: [...state.axes],
          buttons: state.buttons.map((value) => ({ pressed: value > 0.5, touched: value > 0, value })),
          vibrationActuator: null,
        })
        Object.assign(window as unknown as PadHost, { __afPad: state, __afPadSnapshot: snapshot })
        Object.defineProperty(Navigator.prototype, 'getGamepads', {
          configurable: true,
          value: () => [state.connected ? snapshot() : null, null, null, null],
        })
      },
      {
        mapping: options.mapping ?? 'standard',
        id: options.id ?? 'Xbox Wireless Controller (STANDARD GAMEPAD Vendor: 045e)',
      },
    )
    return new FakePad(page)
  }

  /** Drives the pad of `frame` from here on: the game's frame under the fake host. */
  in(frame: Page | Frame): this {
    this.target = frame
    return this
  }

  async connect(): Promise<void> {
    await this.write({ connected: true })
  }

  async unplug(): Promise<void> {
    await this.write({ connected: false })
  }

  async press(button: PadButton, frames = 3): Promise<void> {
    await this.write({ button: [PAD_BUTTONS[button], 1] }, frames)
  }

  async release(button: PadButton): Promise<void> {
    await this.write({ button: [PAD_BUTTONS[button], 0] })
  }

  /** Press and release, held for one polled frame. */
  async tap(button: PadButton): Promise<void> {
    await this.press(button, 1)
    await this.release(button)
  }

  async stick(x: number, y: number, frames = 3): Promise<void> {
    await this.write({ stick: [x, y] }, frames)
  }

  /** Holds a direction on the D-pad or the stick. */
  async hold(direction: Direction, mode: PadMode, frames = 3): Promise<void> {
    if (mode === 'dpad') await this.press(DPAD[direction], frames)
    else await this.stick(...STICK[direction], frames)
  }

  async letGo(direction: Direction, mode: PadMode): Promise<void> {
    if (mode === 'dpad') await this.release(DPAD[direction])
    else await this.stick(0, 0)
  }

  /** One step of a direction: held for one polled frame, then let go. */
  async step(direction: Direction, mode: PadMode): Promise<void> {
    await this.hold(direction, mode, 1)
    await this.letGo(direction, mode)
  }

  /** Waits `count` animation frames in the pad's frame, so the game's per-frame poll has run. */
  async frames(count = 3): Promise<void> {
    await this.target.evaluate(
      (n) =>
        new Promise<void>((resolve) => {
          let left = n
          const tick = (): void => (--left <= 0 ? resolve() : void requestAnimationFrame(tick))
          requestAnimationFrame(tick)
        }),
      count,
    )
  }

  private async write(patch: PadPatch, frames = 3): Promise<void> {
    await this.target.evaluate((change) => {
      const host = window as unknown as PadHost
      const state = host.__afPad
      if (change.connected !== undefined && change.connected !== state.connected) {
        state.connected = change.connected
        const type = change.connected ? 'gamepadconnected' : 'gamepaddisconnected'
        window.dispatchEvent(Object.assign(new Event(type), { gamepad: host.__afPadSnapshot() }))
      }
      if (change.button !== undefined) state.buttons[change.button[0]] = change.button[1]
      if (change.stick !== undefined) [state.axes[0], state.axes[1]] = change.stick
      state.timestamp = performance.now()
    }, patch)
    await this.frames(frames)
  }
}
