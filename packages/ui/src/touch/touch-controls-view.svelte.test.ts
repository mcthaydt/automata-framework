import { flushSync, mount, unmount } from 'svelte'
import { afterEach, describe, expect, it, vi } from 'vitest'
import TouchControls from './TouchControls.svelte'
import type { TouchButtonSpec } from './touch-button'

// The on-screen buttons (M4 spec §4.4, §6 `TouchControls` row), as behavior. The DOM cases of FloorFifty
// `tests/client/systems/gameplay/touch-controls.test.ts` at `ac72660` (capture on the side, page gestures
// cancelled, a near miss in the DOM, release on teardown), plus AF's: hidden without remounting, out of the focus
// order.

const BUTTONS: TouchButtonSpec[] = [
  { action: 'left', label: '←', ariaLabel: 'Move left' },
  { action: 'right', label: '→', ariaLabel: 'Move right' },
  { action: 'drop', label: 'Drop', side: 'end' },
]

let component: ReturnType<typeof mount> | undefined
afterEach(() => {
  if (component !== undefined) unmount(component)
  component = undefined
  document.body.innerHTML = ''
})

function open(buttons: TouchButtonSpec[] = BUTTONS) {
  const held = new Set<string>()
  const props = $state({
    buttons,
    shown: true,
    onhold: vi.fn((action: string) => void held.add(action)),
    onrelease: vi.fn((action: string) => void held.delete(action)),
  })
  const host = document.createElement('div')
  document.body.append(host)
  component = mount(TouchControls, { target: host, props })
  flushSync()
  const root = host.querySelector<HTMLElement>('[data-testid="touch-controls"]') as HTMLElement
  const button = (action: string) =>
    host.querySelector<HTMLElement>(`[data-action="${action}"]`) as HTMLElement
  const side = (name: 'start' | 'end') =>
    host.querySelector<HTMLElement>(`[data-touch-side="${name}"]`) as HTMLElement
  return { props, held, root, button, side }
}

const pointer = (type: string, init: PointerEventInit) => new PointerEvent(type, { bubbles: true, ...init })

describe('TouchControls', () => {
  it('draws one button per action, named in words and kept out of the focus order', () => {
    const { button } = open()
    expect(button('left').getAttribute('aria-label')).toBe('Move left')
    expect(button('drop').getAttribute('aria-label')).toBe('Drop')
    expect(button('left').dataset['testid']).toBe('left')
    for (const action of ['left', 'right', 'drop']) expect(button(action).tabIndex).toBe(-1)
  })

  it('puts each button on its side', () => {
    const { side } = open()
    expect(
      [...side('start').querySelectorAll('[data-action]')].map((b) => b.getAttribute('data-action')),
    ).toEqual(['left', 'right'])
    expect(
      [...side('end').querySelectorAll('[data-action]')].map((b) => b.getAttribute('data-action')),
    ).toEqual(['drop'])
  })

  it('holds while pressed, captures the finger on its side, and lets go on release', () => {
    const { held, button, side } = open()
    const capture = vi.fn()
    side('start').setPointerCapture = capture
    button('left').dispatchEvent(pointer('pointerdown', { pointerId: 7 }))
    expect(capture).toHaveBeenCalledWith(7)
    expect([...held]).toEqual(['left'])
    flushSync()
    expect(button('left').dataset['held']).toBe('true')
    side('start').dispatchEvent(pointer('pointerup', { pointerId: 7 }))
    expect(held.size).toBe(0)
    flushSync()
    expect(button('left').dataset['held']).toBe('false')
  })

  it('reports a second finger on a held button to nobody', () => {
    const { props, button, side } = open()
    button('left').dispatchEvent(pointer('pointerdown', { pointerId: 1 }))
    button('left').dispatchEvent(pointer('pointerdown', { pointerId: 2 }))
    side('start').dispatchEvent(pointer('pointerup', { pointerId: 1 }))
    expect(props.onhold).toHaveBeenCalledTimes(1)
    expect(props.onrelease).not.toHaveBeenCalled()
    side('start').dispatchEvent(pointer('pointercancel', { pointerId: 2 }))
    expect(props.onrelease).toHaveBeenCalledTimes(1)
  })

  it('presses the nearest button from a near miss, and slides a held thumb to the next', () => {
    const { held, button, side } = open()
    const rects: Record<string, [number, number]> = { left: [16, 700], right: [88, 700], drop: [300, 700] }
    for (const [action, [left, top]] of Object.entries(rects))
      button(action).getBoundingClientRect = () =>
        DOMRect.fromRect({ x: left, y: top, width: 60, height: 60 })
    side('start').dispatchEvent(pointer('pointerdown', { pointerId: 3, clientX: 150, clientY: 720 }))
    expect([...held]).toEqual(['right'])
    side('start').dispatchEvent(pointer('pointermove', { pointerId: 3, clientX: 30, clientY: 720 }))
    expect([...held]).toEqual(['left'])
    side('start').dispatchEvent(pointer('pointerup', { pointerId: 3 }))
    expect(held.size).toBe(0)
  })

  it('presses nothing for a finger beyond the margin', () => {
    const { held, button, side } = open()
    for (const action of ['left', 'right', 'drop'])
      button(action).getBoundingClientRect = () => DOMRect.fromRect({ x: 0, y: 700, width: 60, height: 60 })
    side('start').dispatchEvent(pointer('pointerdown', { pointerId: 4, clientX: 200, clientY: 300 }))
    expect(held.size).toBe(0)
  })

  it('cancels touches at their start, so a held thumb never starts a long press or a scroll', () => {
    const { root, button } = open()
    const start = new Event('touchstart', { cancelable: true, bubbles: true })
    const move = new Event('touchmove', { cancelable: true, bubbles: true })
    button('left').dispatchEvent(start)
    root.dispatchEvent(move)
    expect(start.defaultPrevented).toBe(true)
    expect(move.defaultPrevented).toBe(true)
  })

  it('hides without remounting, and releases what was held', () => {
    const { props, held, root, button } = open()
    button('left').dispatchEvent(pointer('pointerdown', { pointerId: 1 }))
    const before = button('left')
    props.shown = false
    flushSync()
    expect(root.hidden).toBe(true)
    expect(held.size).toBe(0)
    props.shown = true
    flushSync()
    expect(root.hidden).toBe(false)
    expect(button('left')).toBe(before)
  })

  it('releases what is held when it comes down', () => {
    const { held, button } = open()
    button('drop').dispatchEvent(pointer('pointerdown', { pointerId: 1 }))
    expect([...held]).toEqual(['drop'])
    if (component !== undefined) unmount(component)
    component = undefined
    expect(held.size).toBe(0)
  })
})
