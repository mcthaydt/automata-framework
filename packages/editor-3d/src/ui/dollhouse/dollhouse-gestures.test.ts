import { describe, expect, it, vi } from 'vitest'
import type { DollhouseController } from '../../app/dollhouse-controller'
import { dollhouseGestures } from './dollhouse-gestures'

// What each gesture does in the dollhouse (plan ED3D.5e decision 2; ED3D spec §10: twist rotates the dollhouse): one
// finger, the mouse or the Pencil orbits; a pinch zooms and its twist turns; the wheel zooms or orbits; a tap selects;
// two- and three-finger taps undo and redo.

function setup() {
  const controller = {
    orbitBy: vi.fn(),
    zoomBy: vi.fn(),
    twist: vi.fn(),
    tap: vi.fn(),
  }
  const history = { onundo: vi.fn(), onredo: vi.fn() }
  const handlers = dollhouseGestures(controller as unknown as DollhouseController, history)
  return { controller, handlers, ...history }
}

const drag = { x: 30, y: 40, startX: 10, startY: 20, dx: 5, dy: -3, pointerType: 'touch' } as const

describe('dollhouseGestures', () => {
  it('orbits by each step of a drag', () => {
    const { controller, handlers } = setup()
    handlers.dragStart?.(drag as never)
    handlers.drag?.(drag as never)
    handlers.dragEnd?.({ ...drag, cancelled: false } as never)
    expect(controller.orbitBy.mock.calls).toEqual([
      [5, -3],
      [5, -3],
      [5, -3],
    ])
  })

  it('zooms and twists with a pinch', () => {
    const { controller, handlers } = setup()
    handlers.pinch?.({ x: 0, y: 0, scale: 1.25, rotation: 0.1 } as never)
    expect(controller.zoomBy).toHaveBeenCalledWith(1.25)
    expect(controller.twist).toHaveBeenCalledWith(0.1)
  })

  it('zooms with a zooming wheel and orbits with a scrolling one', () => {
    const { controller, handlers } = setup()
    handlers.wheel?.({ mode: 'zoom', x: 0, y: 0, dx: 0, dy: 0, scale: 1.1 } as never)
    handlers.wheel?.({ mode: 'pan', x: 0, y: 0, dx: 4, dy: 2, scale: 1 } as never)
    expect(controller.zoomBy).toHaveBeenCalledWith(1.1)
    expect(controller.orbitBy).toHaveBeenCalledWith(4, 2)
  })

  it('selects with a tap, and undoes and redoes with two and three fingers', () => {
    const { controller, handlers, onundo, onredo } = setup()
    handlers.tap?.({ x: 3, y: 4, pointerType: 'pen' } as never)
    expect(controller.tap).toHaveBeenCalledWith({ x: 3, y: 4, kind: 'pen' })
    handlers.multiTap?.({ fingers: 2 } as never)
    handlers.multiTap?.({ fingers: 3 } as never)
    expect(onundo).toHaveBeenCalledOnce()
    expect(onredo).toHaveBeenCalledOnce()
  })
})
