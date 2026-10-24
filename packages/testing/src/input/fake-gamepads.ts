// The unit-test fake gamepad (M4 spec §4.14): a `navigator.getGamepads` stand-in a game's unit tests install
// (`Object.defineProperty(navigator, 'getGamepads', { value: pads.getGamepads })`) and drive. Four slots, as browsers
// give; each read is a snapshot, as a real `Gamepad` is. The browser journeys' pad is `FakePad` (`../e2e`).

const SLOTS = 4
const BUTTONS = 17
/** Browsers count an analog trigger pressed from half travel. */
const PRESSED_FROM = 0.5

interface PadState {
  id: string
  mapping: '' | 'standard'
  buttons: number[]
  axes: number[]
}

/** Four gamepad slots a unit test plugs pads into and presses; `getGamepads` reads them as the browser's would. */
export interface FakeGamepads {
  readonly getGamepads: () => (Gamepad | null)[]
  /** Puts a pad at rest in `index` (0 by default): standard, unless `mapping` says otherwise. */
  connect(index?: number, options?: { readonly mapping?: '' | 'standard'; readonly id?: string }): void
  unplug(index?: number): void
  press(button: number, value?: number, index?: number): void
  release(button: number, index?: number): void
  /** The left stick. */
  stick(x: number, y: number, index?: number): void
}

/** `target` hears `gamepadconnected` and `gamepaddisconnected`, as `window` does in a browser. */
export function fakeGamepads(options: { readonly target?: EventTarget } = {}): FakeGamepads {
  const slots: (PadState | null)[] = Array.from({ length: SLOTS }, () => null)

  const snapshot = (pad: PadState, index: number): Gamepad =>
    ({
      id: pad.id,
      index,
      connected: true,
      mapping: pad.mapping,
      timestamp: 0,
      axes: [...pad.axes],
      buttons: pad.buttons.map((value) => ({ pressed: value >= PRESSED_FROM, touched: value > 0, value })),
      vibrationActuator: null,
    }) as unknown as Gamepad

  const announce = (type: 'gamepadconnected' | 'gamepaddisconnected', gamepad: Gamepad): void => {
    options.target?.dispatchEvent(Object.assign(new Event(type), { gamepad }))
  }

  const padAt = (index: number): PadState => {
    const pad = slots[index]
    if (pad == null) throw new Error(`fakeGamepads: no pad connected at ${index}`)
    return pad
  }

  return {
    getGamepads: () => slots.map((pad, index) => (pad === null ? null : snapshot(pad, index))),
    connect: (index = 0, padOptions = {}) => {
      const pad: PadState = {
        id: padOptions.id ?? 'Standard Gamepad (STANDARD GAMEPAD)',
        mapping: padOptions.mapping ?? 'standard',
        buttons: Array.from({ length: BUTTONS }, () => 0),
        axes: [0, 0, 0, 0],
      }
      slots[index] = pad
      announce('gamepadconnected', snapshot(pad, index))
    },
    unplug: (index = 0) => {
      const pad = padAt(index)
      slots[index] = null
      announce('gamepaddisconnected', { ...snapshot(pad, index), connected: false } as Gamepad)
    },
    press: (button, value = 1, index = 0) => {
      padAt(index).buttons[button] = value
    },
    release: (button, index = 0) => {
      padAt(index).buttons[button] = 0
    },
    stick: (x, y, index = 0) => {
      const pad = padAt(index)
      pad.axes[0] = x
      pad.axes[1] = y
    },
  }
}
