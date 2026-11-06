import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { menuInput } from '#src/app/screens/menu-input.ts'
import { disposables } from '#src/shared/lib/disposables.ts'
import { createInput, type Input } from '#src/features/input/input.manager.ts'
import type { PresentationBus } from '#src/shared/runtime/presentation/presentation-bus.manager.ts'
import { FocusNavigator } from '#src/shared/ui/focus/focus-nav.ts'

// Each test's Inputs and buses, taken down after it.
let owned = disposables()
afterEach(() => {
  owned.dispose()
  owned = disposables()
})
const own = <T extends { dispose(): unknown }>(thing: T): T => {
  owned.add(() => void thing.dispose())
  return thing
}

// The title and paused screens drive the ui FocusNavigator through the M4.1 Input service's menu edges (M4 spec
// §4.7), over a real Input and a fake standard pad: A confirms, B backs out, the D-pad steers with I-d's repeat.
const bus: PresentationBus = { publish: () => {}, subscribe: () => () => {} }
const NO_BINDINGS = { id: 'none', bindings: {} }

let buttons: boolean[] = []
beforeEach(() => {
  buttons = []
  Object.defineProperty(window.navigator, 'getGamepads', {
    configurable: true,
    value: () => [
      {
        id: 'Standard Gamepad',
        index: 0,
        connected: true,
        mapping: 'standard',
        axes: [0, 0, 0, 0],
        buttons: buttons.map((pressed) => ({ pressed, value: pressed ? 1 : 0 })),
      },
    ],
  })
})
afterEach(() => {
  Reflect.deleteProperty(window.navigator, 'getGamepads')
})

describe('menuInput', () => {
  let root: HTMLElement
  let first: HTMLButtonElement
  let second: HTMLButtonElement
  beforeEach(() => {
    root = document.body.appendChild(document.createElement('div'))
    first = root.appendChild(document.createElement('button'))
    second = root.appendChild(document.createElement('button'))
    first.focus()
  })
  afterEach(() => root.remove())

  /** Runs `body` with a menu over a real Input in a fresh scope. */
  const withMenu = (body: (menu: ReturnType<typeof menuInput>, input: Input) => void) => {
    const input = own(createInput({ target: window, profile: NO_BINDINGS, bus }))
    input.setContext('menu')
    const menu = menuInput(input, new FocusNavigator())
    try {
      body(menu, input)
    } finally {
      menu.stop()
    }
  }

  it('a pad A held when the menu starts clicks nothing; a fresh press clicks once (F-a, pad half)', () =>
    withMenu((menu) => {
      const clicked = vi.fn()
      first.addEventListener('click', clicked)
      buttons[0] = true
      menu.poll(0)
      menu.poll(16)
      expect(clicked).not.toHaveBeenCalled()
      buttons[0] = false
      menu.poll(32)
      buttons[0] = true
      menu.poll(48)
      menu.poll(64)
      expect(clicked).toHaveBeenCalledOnce()
    }))

  it('the D-pad steers focus, A clicks and B sends Escape', () =>
    withMenu((menu) => {
      const clicked = vi.fn()
      second.addEventListener('click', clicked)
      const codes: string[] = []
      const onKey = (event: KeyboardEvent) => codes.push(event.code)
      window.addEventListener('keydown', onKey)
      menu.poll(0)
      buttons[13] = true
      menu.poll(16)
      expect(document.activeElement).toBe(second)
      buttons[13] = false
      buttons[0] = true
      menu.poll(32)
      expect(clicked).toHaveBeenCalledOnce()
      buttons[0] = false
      buttons[1] = true
      menu.poll(48)
      window.removeEventListener('keydown', onKey)
      expect(codes).toEqual(['Escape'])
    }))

  it('the keyboard’s Enter and Escape are left to the browser and the screen: no second click or Escape', () =>
    withMenu((menu) => {
      const clicked = vi.fn()
      first.addEventListener('click', clicked)
      const escapes = vi.fn()
      window.addEventListener('keydown', escapes)
      menu.poll(0)
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Enter', key: 'Enter' }))
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', key: 'Escape' }))
      window.removeEventListener('keydown', escapes)
      expect(clicked).not.toHaveBeenCalled()
      expect(escapes).toHaveBeenCalledTimes(2)
    }))

  it('the keyboard’s arrows steer too', () =>
    withMenu((menu) => {
      menu.poll(0)
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowDown', key: 'ArrowDown' }))
      expect(document.activeElement).toBe(second)
    }))

  it('a held D-pad direction moves focus at 0, 400 and 520 ms (I-d, the focus half)', () =>
    withMenu((menu) => {
      const third = root.appendChild(document.createElement('button'))
      const moves: number[] = []
      root.addEventListener('focusin', () => moves.push(now))
      let now = 0
      menu.poll(now)
      buttons[13] = true
      for (now = 0; now <= 560; now += 8) menu.poll(now)
      expect(moves).toEqual([0, 400, 520])
      // Down walks DOM order and wraps: second, third, then first again.
      expect(document.activeElement).toBe(first)
      third.remove()
    }))
})
