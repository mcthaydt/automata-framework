import { getByRole } from '@testing-library/dom'
import { flushSync, mount, unmount } from 'svelte'
import { afterEach, describe, expect, it, vi } from 'vitest'
import TouchControls from './TouchControls.svelte'
import type { TouchButtonSpec } from './touch-button'

// The touch move stick on the overlay (M4 spec §16.3.3, A-n), as behavior. The DOM cases of The Last Light
// `tests/input.test.ts` at `92e6704` ("the stick spawns at the touch point, moves in any direction, and resets on
// release", "blur and pointer cancellation release the stick"), on AF's overlay: the vector goes out through
// `onstick`, the release through `onstickend`, exactly once.

const BUTTONS: TouchButtonSpec[] = [{ action: 'attack', label: 'Attack', side: 'end', required: true }]

let component: ReturnType<typeof mount> | undefined
afterEach(() => {
  if (component !== undefined) unmount(component)
  component = undefined
  document.body.innerHTML = ''
})

function open(withStick = true) {
  const vectors: [number, number][] = []
  const props = $state({
    buttons: BUTTONS,
    shown: true,
    onhold: vi.fn(),
    onrelease: vi.fn(),
    ...(withStick ? { stick: { label: 'Move' } } : {}),
    onstick: vi.fn((x: number, y: number) => void vectors.push([x, y])),
    onstickend: vi.fn(),
  })
  const host = document.createElement('div')
  document.body.append(host)
  component = mount(TouchControls, { target: host, props })
  flushSync()
  const zone = host.querySelector<HTMLElement>('[data-touch-stick]')
  return { props, vectors, zone, host }
}

const pointer = (type: string, init: PointerEventInit) =>
  new PointerEvent(type, { bubbles: true, cancelable: true, pointerType: 'touch', ...init })

describe('TouchControls move stick', () => {
  it('draws no stick unless asked, so the 2D overlay is unchanged', () => {
    expect(open(false).zone).toBeNull()
  })

  it('draws a named zone at the start, out of the focus order, idle', () => {
    const { zone, host } = open()
    if (zone === null) throw new Error('no stick zone')
    expect(zone.getAttribute('aria-label')).toBe('Move')
    // A named group, so assistive technology reads the name (a `presentation` role drops it).
    expect(getByRole(document.body, 'group', { name: 'Move' })).toBe(zone)
    expect(zone.dataset['stickState']).toBe('idle')
    expect(zone.tabIndex).toBe(-1)
    expect(zone.dataset['testid']).toBe('touch-stick')
    expect(host.querySelector('[data-touch-overlay]')?.firstElementChild).toBe(zone)
  })

  it('takes its origin where the thumb lands, sends the vector as it moves, and centres on lift (A-n)', () => {
    const { zone, vectors, props } = open()
    if (zone === null) throw new Error('no stick zone')
    const capture = vi.fn()
    zone.setPointerCapture = capture
    zone.dispatchEvent(pointer('pointerdown', { pointerId: 7, clientX: 60, clientY: 200 }))
    expect(capture).toHaveBeenCalledWith(7)
    flushSync()
    expect(zone.dataset['stickState']).toBe('held')
    zone.dispatchEvent(pointer('pointermove', { pointerId: 7, clientX: 60, clientY: 152 }))
    zone.dispatchEvent(pointer('pointermove', { pointerId: 7, clientX: 84, clientY: 200 }))
    expect(vectors).toEqual([
      [0, -1],
      [0.5, 0],
    ])
    zone.dispatchEvent(pointer('pointerup', { pointerId: 7, clientX: 84, clientY: 200 }))
    expect(props.onstickend).toHaveBeenCalledTimes(1)
    flushSync()
    expect(zone.dataset['stickState']).toBe('idle')
    zone.dispatchEvent(pointer('lostpointercapture', { pointerId: 7 }))
    expect(props.onstickend).toHaveBeenCalledTimes(1)
  })

  it('ignores another finger while one holds it', () => {
    const { zone, vectors, props } = open()
    if (zone === null) throw new Error('no stick zone')
    zone.dispatchEvent(pointer('pointerdown', { pointerId: 7, clientX: 60, clientY: 200 }))
    zone.dispatchEvent(pointer('pointerdown', { pointerId: 9, clientX: 10, clientY: 10 }))
    zone.dispatchEvent(pointer('pointermove', { pointerId: 9, clientX: 100, clientY: 10 }))
    zone.dispatchEvent(pointer('pointerup', { pointerId: 9, clientX: 100, clientY: 10 }))
    expect(vectors).toEqual([])
    expect(props.onstickend).not.toHaveBeenCalled()
    zone.dispatchEvent(pointer('pointermove', { pointerId: 7, clientX: 36, clientY: 200 }))
    expect(vectors).toEqual([[-0.5, 0]])
  })

  it('lets go on a cancel, and on hiding while held, once each', () => {
    const { zone, props } = open()
    if (zone === null) throw new Error('no stick zone')
    zone.dispatchEvent(pointer('pointerdown', { pointerId: 7, clientX: 60, clientY: 200 }))
    zone.dispatchEvent(pointer('pointercancel', { pointerId: 7 }))
    expect(props.onstickend).toHaveBeenCalledTimes(1)
    zone.dispatchEvent(pointer('pointerdown', { pointerId: 8, clientX: 60, clientY: 200 }))
    props.shown = false
    flushSync()
    expect(props.onstickend).toHaveBeenCalledTimes(2)
    props.shown = true
    flushSync()
    expect(props.onstickend).toHaveBeenCalledTimes(2)
  })

  it('lets go when it comes down while held', () => {
    const { zone, props } = open()
    if (zone === null) throw new Error('no stick zone')
    zone.dispatchEvent(pointer('pointerdown', { pointerId: 7, clientX: 60, clientY: 200 }))
    if (component !== undefined) unmount(component)
    component = undefined
    expect(props.onstickend).toHaveBeenCalledTimes(1)
  })

  it('cancels the page’s touch gestures on the zone', () => {
    const { zone } = open()
    if (zone === null) throw new Error('no stick zone')
    const touch = new Event('touchstart', { bubbles: true, cancelable: true })
    zone.dispatchEvent(touch)
    expect(touch.defaultPrevented).toBe(true)
  })
})
