import type { PadLike } from '../read-pad.js'

/** A standard pad at rest that can be pushed and pressed, each call returning a new pad. */
export interface FakePad extends PadLike {
  press(button: number, value?: number): FakePad
  stick(x: number, y: number, side?: 'left' | 'right'): FakePad
}

export function fakePad(options: Partial<Pick<PadLike, 'id' | 'index' | 'mapping'>> = {}): FakePad {
  return make({
    id: options.id ?? 'Standard Gamepad',
    index: options.index ?? 0,
    connected: true,
    mapping: options.mapping ?? 'standard',
    axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
  })
}

function make(pad: PadLike): FakePad {
  return {
    ...pad,
    press: (button, value = 1) =>
      make({
        ...pad,
        buttons: pad.buttons.map((entry, index) =>
          index === button ? { pressed: value >= 0.5 || button < 6 || button > 7, value } : entry,
        ),
      }),
    stick: (x, y, side = 'left') => {
      const axes = [...pad.axes]
      const first = side === 'left' ? 0 : 2
      axes[first] = x
      axes[first + 1] = y
      return make({ ...pad, axes })
    },
  }
}
