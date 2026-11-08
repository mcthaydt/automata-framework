// What each gesture does in the Walk view (ED3D.8b; ED3D spec §10): a tap picks what the crosshair is on, a finger or the mouse
// dragging looks, the Pencil never moves the camera, a two-finger tap undoes and a three-finger tap redoes.
import { describe, expect, it, vi } from 'vitest'
import { walkGestures } from '#src/features/levels-3d/walk/walk-gestures.ts'

function setup() {
  const walk = { lookBy: vi.fn(), pick: vi.fn() }
  const history = { onundo: vi.fn(), onredo: vi.fn() }
  return { walk, handlers: walkGestures(walk, history), ...history }
}

describe('walkGestures', () => {
  it('picks on a tap, from any pointer, and looks by a finger’s or the mouse’s drag', () => {
    const { walk, handlers } = setup()
    handlers.tap?.({ x: 1, y: 2, pointerType: 'pen' } as never)
    expect(walk.pick).toHaveBeenCalledTimes(1)
    handlers.drag?.({ dx: 20, dy: 10, pointerType: 'touch' } as never)
    const [yaw, pitch] = walk.lookBy.mock.calls[0] as [number, number]
    expect(yaw).toBeGreaterThan(0)
    expect(pitch).toBeLessThan(0)
    handlers.drag?.({ dx: -20, dy: -10, pointerType: 'mouse' } as never)
    expect((walk.lookBy.mock.calls[1] as [number, number])[0]).toBeLessThan(0)
  })

  it('never moves the camera with the Pencil', () => {
    const { walk, handlers } = setup()
    handlers.dragStart?.({ dx: 5, dy: 5, pointerType: 'pen' } as never)
    handlers.drag?.({ dx: 20, dy: 10, pointerType: 'pen' } as never)
    expect(walk.lookBy).not.toHaveBeenCalled()
  })

  it('undoes with two fingers and redoes with three', () => {
    const { handlers, onundo, onredo } = setup()
    handlers.multiTap?.({ fingers: 2 } as never)
    handlers.multiTap?.({ fingers: 3 } as never)
    expect([onundo.mock.calls.length, onredo.mock.calls.length]).toEqual([1, 1])
  })
})
