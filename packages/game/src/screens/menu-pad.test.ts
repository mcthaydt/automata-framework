import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { menuPad } from './menu-pad.ts'

// A controller on the title and paused screens (G-8): the standard mapping's A (button 0) clicks the
// focused button, B (button 1) sends Escape, each once per press.
function fakePad(mapping = 'standard') {
  const buttons = [{ pressed: false }, { pressed: false }]
  return { pad: { mapping, buttons } as unknown as Gamepad, buttons }
}

describe('menuPad', () => {
  let root: HTMLElement
  let button: HTMLButtonElement
  let pads: (Gamepad | null)[]
  const read = () => pads

  beforeEach(() => {
    root = document.body.appendChild(document.createElement('div'))
    button = root.appendChild(document.createElement('button'))
    button.focus()
    pads = []
  })
  afterEach(() => root.remove())

  it('A clicks the focused button once per press', () => {
    const { pad, buttons } = fakePad()
    pads = [null, pad]
    const clicked = vi.fn()
    button.addEventListener('click', clicked)
    const menu = menuPad(read)
    menu.poll()
    buttons[0] = { pressed: true }
    menu.poll()
    menu.poll()
    expect(clicked).toHaveBeenCalledTimes(1)
    buttons[0] = { pressed: false }
    menu.poll()
    buttons[0] = { pressed: true }
    menu.poll()
    expect(clicked).toHaveBeenCalledTimes(2)
  })

  it('B sends Escape to the focused element, bubbling to the window', () => {
    const { pad, buttons } = fakePad()
    pads = [pad]
    const codes: string[] = []
    const onKey = (event: KeyboardEvent) => codes.push(event.code)
    window.addEventListener('keydown', onKey)
    const menu = menuPad(read)
    menu.poll()
    buttons[1] = { pressed: true }
    menu.poll()
    menu.poll()
    window.removeEventListener('keydown', onKey)
    expect(codes).toEqual(['Escape'])
  })

  it('a button already held when the screen opens does nothing until pressed again', () => {
    const { pad, buttons } = fakePad()
    buttons[0] = { pressed: true }
    pads = [pad]
    const clicked = vi.fn()
    button.addEventListener('click', clicked)
    const menu = menuPad(read)
    menu.poll()
    expect(clicked).not.toHaveBeenCalled()
  })

  it('ignores a pad without the standard mapping', () => {
    const { pad, buttons } = fakePad('')
    pads = [pad]
    const clicked = vi.fn()
    button.addEventListener('click', clicked)
    const menu = menuPad(read)
    menu.poll()
    buttons[0] = { pressed: true }
    menu.poll()
    expect(clicked).not.toHaveBeenCalled()
  })
})
