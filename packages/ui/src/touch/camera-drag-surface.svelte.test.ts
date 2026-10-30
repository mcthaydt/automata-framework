import { flushSync, mount, unmount } from 'svelte'
import { afterEach, describe, expect, it, vi } from 'vitest'
import CameraDragFixture from '../testing/CameraDragFixture.svelte'
import CameraDragSurface from './CameraDragSurface.svelte'
import type { DragTracker } from './camera-drag-surface'

// The camera drag surface (M4 spec §16.3.7, M3 spec §7 "Camera turn" row): it forwards pointers to runtime's
// `CameraDragTracker`, which decides who drags; it sits under the controls, so a contact on one never reaches it.

let component: ReturnType<typeof mount> | undefined
afterEach(() => {
  if (component !== undefined) unmount(component)
  component = undefined
  document.body.innerHTML = ''
})

/** A tracker that accepts what the real one would: a finger's primary contact or the mouse's secondary button. */
function stubTracker() {
  let dragging: number | undefined
  return {
    down: vi.fn((id: number, _x: number, start: { pointerType: string; button: number }) => {
      if (dragging !== undefined) return false
      if (start.button !== (start.pointerType === 'mouse' ? 2 : 0)) return false
      dragging = id
      return true
    }),
    move: vi.fn(),
    up: vi.fn((id: number) => {
      if (id === dragging) dragging = undefined
    }),
    cancel: vi.fn(() => {
      dragging = undefined
    }),
  } satisfies DragTracker
}

function open(tracker: DragTracker) {
  const host = document.createElement('div')
  document.body.append(host)
  component = mount(CameraDragSurface, { target: host, props: { tracker } })
  flushSync()
  return host.querySelector<HTMLElement>('[data-testid="camera-drag"]') as HTMLElement
}

const pointer = (type: string, init: PointerEventInit) =>
  new PointerEvent(type, { bubbles: true, cancelable: true, ...init })

describe('CameraDragSurface', () => {
  it('forwards a finger’s drag with its x, captures it and shows it dragging', () => {
    const tracker = stubTracker()
    const surface = open(tracker)
    const capture = vi.fn()
    surface.setPointerCapture = capture
    expect(surface.dataset['dragState']).toBe('idle')
    surface.dispatchEvent(
      pointer('pointerdown', { pointerId: 3, clientX: 100, pointerType: 'touch', button: 0 }),
    )
    expect(tracker.down).toHaveBeenCalledWith(3, 100, { pointerType: 'touch', button: 0 })
    expect(capture).toHaveBeenCalledWith(3)
    flushSync()
    expect(surface.dataset['dragState']).toBe('touch')
    surface.dispatchEvent(pointer('pointermove', { pointerId: 3, clientX: 130 }))
    expect(tracker.move).toHaveBeenCalledWith(3, 130)
    surface.dispatchEvent(pointer('pointerup', { pointerId: 3, clientX: 130 }))
    expect(tracker.up).toHaveBeenCalledWith(3)
    flushSync()
    expect(surface.dataset['dragState']).toBe('idle')
  })

  it('drags with the mouse’s secondary button and cancels its context menu (A-o)', () => {
    const tracker = stubTracker()
    const surface = open(tracker)
    surface.dispatchEvent(
      pointer('pointerdown', { pointerId: 1, clientX: 10, pointerType: 'mouse', button: 2 }),
    )
    flushSync()
    expect(surface.dataset['dragState']).toBe('mouse')
    const menu = new MouseEvent('contextmenu', { bubbles: true, cancelable: true })
    surface.dispatchEvent(menu)
    expect(menu.defaultPrevented).toBe(true)
    surface.dispatchEvent(pointer('pointermove', { pointerId: 1, clientX: 4 }))
    expect(tracker.move).toHaveBeenCalledWith(1, 4)
  })

  it('does not capture a pointer the tracker refused, and stays idle', () => {
    const tracker = stubTracker()
    const surface = open(tracker)
    const capture = vi.fn()
    surface.setPointerCapture = capture
    surface.dispatchEvent(
      pointer('pointerdown', { pointerId: 1, clientX: 10, pointerType: 'mouse', button: 0 }),
    )
    expect(tracker.down).toHaveBeenCalledTimes(1)
    expect(capture).not.toHaveBeenCalled()
    flushSync()
    expect(surface.dataset['dragState']).toBe('idle')
  })

  it('ends the drag on a cancel and on a lost capture', () => {
    const tracker = stubTracker()
    const surface = open(tracker)
    surface.dispatchEvent(
      pointer('pointerdown', { pointerId: 3, clientX: 0, pointerType: 'touch', button: 0 }),
    )
    surface.dispatchEvent(pointer('pointercancel', { pointerId: 3 }))
    surface.dispatchEvent(pointer('lostpointercapture', { pointerId: 3 }))
    expect(tracker.up).toHaveBeenCalledTimes(2)
    flushSync()
    expect(surface.dataset['dragState']).toBe('idle')
  })

  it('cancels the page’s touch gestures, and lets go of the drag when it comes down', () => {
    const tracker = stubTracker()
    const surface = open(tracker)
    const touch = new Event('touchmove', { bubbles: true, cancelable: true })
    surface.dispatchEvent(touch)
    expect(touch.defaultPrevented).toBe(true)
    if (component !== undefined) unmount(component)
    component = undefined
    expect(tracker.cancel).toHaveBeenCalledTimes(1)
  })

  it('never hears a contact on the controls drawn above it (A-p)', () => {
    const tracker = stubTracker()
    const host = document.createElement('div')
    document.body.append(host)
    component = mount(CameraDragFixture, { target: host, props: { tracker } })
    flushSync()
    for (const target of [
      host.querySelector<HTMLElement>('[data-action="attack"]'),
      host.querySelector<HTMLElement>('[data-touch-stick]'),
      host.querySelector<HTMLElement>('[data-testid="pause"]'),
    ]) {
      if (target === null) throw new Error('fixture control missing')
      target.dispatchEvent(
        pointer('pointerdown', { pointerId: 5, clientX: 1, pointerType: 'touch', button: 0 }),
      )
      target.dispatchEvent(pointer('pointermove', { pointerId: 5, clientX: 40 }))
      target.dispatchEvent(pointer('pointerup', { pointerId: 5, clientX: 40 }))
    }
    expect(tracker.down).not.toHaveBeenCalled()
    expect(tracker.move).not.toHaveBeenCalled()
  })
})
