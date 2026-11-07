import { flushSync, mount, unmount } from 'svelte'
import { afterEach, describe, expect, it, vi } from 'vitest'
import SwipeSurface from '#src/shared/ui/touch/SwipeSurface.svelte'
import type { PointerTracker, SwipeIndicatorView } from '#src/shared/ui/touch/swipe-surface.ts'

// The swipe surface (M4 spec §4.4, §6 `SwipeSurface` row), from FloorFifty `ui/components/SwipeSurface.svelte` at
// `ac72660`: it forwards pointer events, with their own timestamps, to a tracker and draws the thumb's line.

let component: ReturnType<typeof mount> | undefined
afterEach(() => {
  if (component !== undefined) unmount(component)
  component = undefined
  document.body.innerHTML = ''
})

function stubTracker() {
  let indicator: SwipeIndicatorView | undefined
  const tracker = {
    tuning: { saturationPx: 48 },
    get indicator() {
      return indicator
    },
    down: vi.fn((_id: number, x: number, y: number) => {
      indicator = { anchor: { x, y }, thumb: { x, y }, steering: false }
    }),
    move: vi.fn((_id: number, x: number, y: number) => {
      if (indicator !== undefined) indicator = { ...indicator, thumb: { x, y }, steering: true }
    }),
    up: vi.fn(() => {
      indicator = undefined
    }),
    cancel: vi.fn(),
  } satisfies PointerTracker
  return tracker
}

function open(tracker: PointerTracker, steers?: (x: number, y: number) => boolean) {
  const host = document.createElement('div')
  document.body.append(host)
  component = mount(SwipeSurface, { target: host, props: { tracker, steers } })
  flushSync()
  return host.querySelector<HTMLElement>('[data-testid="swipe-surface"]') as HTMLElement
}

/** A pointer event with a chosen `timeStamp`, which the constructor cannot set. */
const pointer = (type: string, init: PointerEventInit, timeStamp: number): PointerEvent => {
  const event = new PointerEvent(type, { bubbles: true, cancelable: true, ...init })
  Object.defineProperty(event, 'timeStamp', { value: timeStamp })
  return event
}

describe('SwipeSurface', () => {
  it('forwards each finger with its position and the event timestamp', () => {
    const tracker = stubTracker()
    const surface = open(tracker)
    surface.dispatchEvent(pointer('pointerdown', { pointerId: 1, clientX: 10, clientY: 20 }, 100))
    surface.dispatchEvent(pointer('pointermove', { pointerId: 1, clientX: 30, clientY: 25 }, 116))
    surface.dispatchEvent(pointer('pointerup', { pointerId: 1, clientX: 30, clientY: 25 }, 132))
    expect(tracker.down).toHaveBeenCalledWith(1, 10, 20, 100, { steers: true })
    expect(tracker.move).toHaveBeenCalledWith(1, 30, 25, 116)
    expect(tracker.up).toHaveBeenCalledWith(1, 30, 25, 132)
  })

  it('asks steers whether a finger may steer', () => {
    const tracker = stubTracker()
    const surface = open(tracker, (_x, y) => y > 300)
    surface.dispatchEvent(pointer('pointerdown', { pointerId: 1, clientX: 10, clientY: 20 }, 0))
    surface.dispatchEvent(pointer('pointerdown', { pointerId: 2, clientX: 10, clientY: 400 }, 0))
    expect(tracker.down).toHaveBeenNthCalledWith(1, 1, 10, 20, 0, { steers: false })
    expect(tracker.down).toHaveBeenNthCalledWith(2, 2, 10, 400, 0, { steers: true })
  })

  it('lifts only the finger that was cancelled or lost its capture', () => {
    const tracker = stubTracker()
    const surface = open(tracker)
    surface.dispatchEvent(pointer('pointerdown', { pointerId: 1, clientX: 10, clientY: 20 }, 0))
    surface.dispatchEvent(pointer('pointercancel', { pointerId: 1, clientX: 10, clientY: 20 }, 5))
    surface.dispatchEvent(pointer('lostpointercapture', { pointerId: 2, clientX: 0, clientY: 0 }, 6))
    expect(tracker.up).toHaveBeenCalledWith(1, 10, 20, 5)
    expect(tracker.up).toHaveBeenCalledWith(2, 0, 0, 6)
    expect(tracker.cancel).not.toHaveBeenCalled()
  })

  it('cancels a touch at its start and keeps the page from scrolling under a drag', () => {
    const surface = open(stubTracker())
    const start = new Event('touchstart', { cancelable: true, bubbles: true })
    const down = pointer('pointerdown', { pointerId: 1 }, 0)
    surface.dispatchEvent(start)
    surface.dispatchEvent(down)
    expect(start.defaultPrevented).toBe(true)
    expect(down.defaultPrevented).toBe(true)
  })

  it('draws the line while a finger steers, faint inside the dead zone, and none after it lifts', () => {
    const surface = open(stubTracker())
    const line = () => surface.querySelector<HTMLElement>('[data-swipe-line]')
    expect(line()).toBeNull()
    surface.dispatchEvent(pointer('pointerdown', { pointerId: 1, clientX: 10, clientY: 20 }, 0))
    flushSync()
    expect(line()?.dataset['steering']).toBe('false')
    surface.dispatchEvent(pointer('pointermove', { pointerId: 1, clientX: 40, clientY: 20 }, 10))
    flushSync()
    expect(line()?.dataset['steering']).toBe('true')
    expect(line()?.style.width).toBe('30px')
    surface.dispatchEvent(pointer('pointerup', { pointerId: 1, clientX: 40, clientY: 20 }, 20))
    flushSync()
    expect(line()).toBeNull()
  })

  it('cancels every finger when it comes down', () => {
    const tracker = stubTracker()
    open(tracker)
    if (component !== undefined) unmount(component)
    component = undefined
    expect(tracker.cancel).toHaveBeenCalledTimes(1)
  })
})
