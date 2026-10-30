import { describe, expect, it, vi } from 'vitest'
import type { PlanController } from '../../app/plan-controller'
import { planGestures } from './plan-gestures'

// What each gesture of the kit's recogniser does on the plan (plan ED3D.5d step 5; ED3D spec §10): taps, drags and
// hovers go to the Select tool's controller with the pointer's kind and keys; two fingers and the wheel move the
// camera; a two-finger tap undoes and a three-finger tap redoes.

const NO_MODIFIERS = { shift: false, ctrl: false, alt: false, meta: false }

function fakeController() {
  return {
    hover: vi.fn(),
    leave: vi.fn(),
    tap: vi.fn(),
    dragStart: vi.fn(),
    drag: vi.fn(),
    dragEnd: vi.fn(),
    panBy: vi.fn(),
    zoomAt: vi.fn(),
  }
}

const drag = {
  x: 30,
  y: 40,
  startX: 10,
  startY: 20,
  dx: 20,
  dy: 20,
  pressure: 0.5,
  tiltX: 0,
  tiltY: 0,
  pointerType: 'pen' as const,
  button: 0,
  modifiers: { ...NO_MODIFIERS, shift: true },
}

function setup() {
  const controller = fakeController()
  const history = { onundo: vi.fn(), onredo: vi.fn() }
  const handlers = planGestures(controller as unknown as PlanController, history)
  return { controller, handlers, ...history }
}

describe('planGestures', () => {
  it('taps with the kind and the keys: Ctrl or Meta adds to the selection', () => {
    const { controller, handlers } = setup()
    handlers.tap?.({ x: 5, y: 6, count: 1, pointerType: 'touch', modifiers: { ...NO_MODIFIERS, meta: true } })
    expect(controller.tap).toHaveBeenCalledWith({
      x: 5,
      y: 6,
      kind: 'touch',
      shift: false,
      alt: false,
      additive: true,
    })
  })

  it('drags from where the press began, and ends a cancelled drag as cancelled', () => {
    const { controller, handlers } = setup()
    handlers.dragStart?.({ ...drag, afterLongPress: false })
    expect(controller.dragStart).toHaveBeenCalledWith(
      { x: 10, y: 20, kind: 'pen', shift: true, alt: false, additive: false },
      { x: 30, y: 40, kind: 'pen', shift: true, alt: false, additive: false },
    )
    handlers.drag?.(drag)
    expect(controller.drag).toHaveBeenCalledWith({
      x: 30,
      y: 40,
      kind: 'pen',
      shift: true,
      alt: false,
      additive: false,
    })
    handlers.dragEnd?.({ ...drag, cancelled: true })
    expect(controller.dragEnd).toHaveBeenCalledWith(expect.objectContaining({ x: 30, y: 40 }), true)
  })

  it('pans with two fingers and the wheel, and zooms with a pinch and Ctrl-wheel about the point', () => {
    const { controller, handlers } = setup()
    handlers.pan?.({ phase: 'change', x: 0, y: 0, dx: 4, dy: -3, cancelled: false })
    handlers.wheel?.({ mode: 'pan', x: 0, y: 0, dx: 1, dy: 2, scale: 1, modifiers: NO_MODIFIERS })
    expect(controller.panBy.mock.calls).toEqual([
      [4, -3],
      [1, 2],
    ])
    handlers.pinch?.({
      phase: 'change',
      x: 50,
      y: 60,
      scale: 1.25,
      totalScale: 1.25,
      rotation: 0,
      totalRotation: 0,
      cancelled: false,
    })
    handlers.wheel?.({ mode: 'zoom', x: 7, y: 8, dx: 0, dy: 0, scale: 0.8, modifiers: NO_MODIFIERS })
    expect(controller.zoomAt.mock.calls).toEqual([
      [{ x: 50, y: 60 }, 1.25],
      [{ x: 7, y: 8 }, 0.8],
    ])
  })

  it('hovers with a mouse or a hovering Pencil', () => {
    const { controller, handlers } = setup()
    handlers.hover?.({
      x: 1,
      y: 2,
      pointerType: 'pen',
      pressure: 0,
      tiltX: 0,
      tiltY: 0,
      modifiers: NO_MODIFIERS,
    })
    expect(controller.hover).toHaveBeenCalledWith({
      x: 1,
      y: 2,
      kind: 'pen',
      shift: false,
      alt: false,
      additive: false,
    })
  })

  it('undoes with a two-finger tap and redoes with three', () => {
    const { handlers, onundo, onredo } = setup()
    handlers.multiTap?.({ x: 0, y: 0, fingers: 2 })
    handlers.multiTap?.({ x: 0, y: 0, fingers: 3 })
    expect(onundo).toHaveBeenCalledOnce()
    expect(onredo).toHaveBeenCalledOnce()
  })
})
