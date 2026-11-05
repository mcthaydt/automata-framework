import { describe, expect, it } from 'vitest'
import {
  keyLabel,
  type PromptCopy,
  padLabel,
  promptView,
  readKeyboardLayout,
} from '#src/shared/ui/prompts/prompt-label.ts'

// Device prompts (M4 spec §4.6): the label for the active device. A key by the keyboard's own layout when the browser
// tells it, else its `code`; a pad button by what is printed on the pad's family (FloorFifty ui/glyphs.ts), or a word
// for a generic pad; the touch label on touch; "Unbound", never an empty box, for an action with nothing there.

const copy: PromptCopy = {
  unbound: 'Unbound',
  touch: 'Tap',
  pad: {
    bottom: 'Bottom button',
    right: 'Right button',
    left: 'Left button',
    top: 'Top button',
    leftBumper: 'Left bumper',
    rightBumper: 'Right bumper',
    leftTrigger: 'Left trigger',
    rightTrigger: 'Right trigger',
    select: 'Select',
    start: 'Start',
    leftStick: 'Left stick',
    rightStick: 'Right stick',
    home: 'Home',
  },
}

describe('keyLabel', () => {
  it('names a key by its code without the Key and Digit prefixes, and an arrow by its arrow', () => {
    expect(keyLabel('KeyK')).toBe('K')
    expect(keyLabel('Digit1')).toBe('1')
    expect(keyLabel('ArrowLeft')).toBe('←')
    expect(keyLabel('Space')).toBe('Space')
  })

  it('takes the keyboard layout’s label first, a letter in capitals', () => {
    expect(keyLabel('KeyQ', new Map([['KeyQ', 'a']]))).toBe('A')
    expect(keyLabel('Semicolon', new Map([['Semicolon', 'ö']]))).toBe('Ö')
    expect(keyLabel('KeyK', new Map())).toBe('K')
  })
})

describe('padLabel', () => {
  it('names a face button as printed on the pad', () => {
    expect([0, 1, 2, 3].map((button) => padLabel(button, 'xbox', copy))).toEqual(['A', 'B', 'X', 'Y'])
    expect([0, 1, 2, 3].map((button) => padLabel(button, 'playstation', copy))).toEqual(['✕', '○', '□', '△'])
  })

  it('names a generic pad’s buttons in words, and the D-pad by its arrows on every pad', () => {
    expect(padLabel(0, 'generic', copy)).toBe('Bottom button')
    expect(padLabel(9, 'generic', copy)).toBe('Start')
    expect([12, 13, 14, 15].map((button) => padLabel(button, 'xbox', copy))).toEqual(['↑', '↓', '←', '→'])
    expect(padLabel(4, 'xbox', copy)).toBe('LB')
    expect(padLabel(7, 'playstation', copy)).toBe('R2')
  })
})

describe('promptView', () => {
  const binding = { keys: ['KeyK', 'Space'], pad: [0], touch: true }

  it('shows the active device’s first input', () => {
    expect(promptView(binding, 'keyboard', 'generic', copy)).toEqual({ kind: 'key', label: 'K' })
    expect(promptView(binding, 'gamepad', 'playstation', copy)).toEqual({ kind: 'pad', label: '✕' })
    expect(promptView(binding, 'touch', 'generic', copy)).toEqual({ kind: 'touch', label: 'Tap' })
  })

  it('says Unbound when the action has nothing on the active device', () => {
    const none = { keys: [], pad: [], touch: false }
    for (const device of ['keyboard', 'gamepad', 'touch'] as const)
      expect(promptView(none, device, 'xbox', copy)).toEqual({ kind: 'unbound', label: 'Unbound' })
  })
})

describe('readKeyboardLayout', () => {
  it('reads the layout map where the browser has one', async () => {
    const layout = new Map([['KeyQ', 'a']])
    const nav = { keyboard: { getLayoutMap: async () => layout } } as unknown as Navigator
    expect(await readKeyboardLayout(nav)).toBe(layout)
  })

  it('is undefined where the browser has none, or refuses', async () => {
    expect(await readKeyboardLayout({} as Navigator)).toBeUndefined()
    const refusing = {
      keyboard: { getLayoutMap: async () => Promise.reject(new Error('not allowed in a frame')) },
    } as unknown as Navigator
    expect(await readKeyboardLayout(refusing)).toBeUndefined()
  })
})
