import type { DragGesture, Modifiers, PointerKind } from '@mcthaydt/automata-editor-kit'
import { describe, expect, it } from 'vitest'
import { type WorldGestureTarget, worldGestures } from './world-gestures'

// The map's gestures (plan ED2D.8a decision 1) against a fake target that records what they ask for. A level sits
// under (100, 100); everywhere else is empty space.

function fake() {
  const calls: string[] = []
  const target: WorldGestureTarget = {
    levelAt: (point) => (point.x === 100 && point.y === 100 ? 'inn' : undefined),
    drag: {
      down: (point) => calls.push(`down ${point.x},${point.y}`),
      move: (point) => calls.push(`move ${point.x},${point.y}`),
      up: () => calls.push('up'),
      cancel: () => calls.push('cancel'),
    },
    panBy: (dx, dy) => calls.push(`pan ${dx},${dy}`),
    zoomAt: (point, factor) => calls.push(`zoom ${point.x},${point.y} ×${factor}`),
  }
  const history = { onundo: () => calls.push('undo'), onredo: () => calls.push('redo') }
  return { calls, handlers: worldGestures(target, history) }
}

const NO_KEYS: Modifiers = { shift: false, alt: false, ctrl: false, meta: false }

const drag = (
  x: number,
  y: number,
  start: { x: number; y: number },
  pointerType: PointerKind = 'mouse',
  button = 0,
  cancelled = false,
): DragGesture =>
  ({
    x,
    y,
    startX: start.x,
    startY: start.y,
    dx: 5,
    dy: 0,
    pressure: 0.5,
    tiltX: 0,
    tiltY: 0,
    pointerType,
    button,
    modifiers: NO_KEYS,
    cancelled,
  }) as DragGesture

describe('worldGestures', () => {
  it('a tap selects what is under it through the drag, which moves nothing', () => {
    const { calls, handlers } = fake()
    handlers.tap?.({ x: 100, y: 100, count: 1, pointerType: 'touch', modifiers: NO_KEYS })
    handlers.tap?.({ x: 300, y: 300, count: 1, pointerType: 'mouse', modifiers: NO_KEYS })
    expect(calls).toEqual(['down 100,100', 'up', 'down 300,300', 'up'])
  })

  it('a drag that starts on a level moves it; one that starts on empty space pans', () => {
    const { calls, handlers } = fake()
    const on = { x: 100, y: 100 }
    handlers.dragStart?.(drag(105, 100, on))
    handlers.drag?.(drag(110, 100, on))
    handlers.dragEnd?.(drag(115, 100, on))
    const off = { x: 300, y: 300 }
    handlers.dragStart?.(drag(305, 300, off, 'touch'))
    handlers.drag?.(drag(310, 300, off, 'touch'))
    handlers.dragEnd?.(drag(315, 300, off, 'touch'))
    expect(calls).toEqual([
      'down 100,100',
      'move 105,100',
      'move 110,100',
      'move 115,100',
      'up',
      'pan 5,0',
      'pan 5,0',
    ])
  })

  it('a cancelled drag puts the level back', () => {
    const { calls, handlers } = fake()
    const on = { x: 100, y: 100 }
    handlers.dragStart?.(drag(105, 100, on))
    handlers.dragEnd?.(drag(105, 100, on, 'mouse', 0, true))
    expect(calls.at(-1)).toBe('cancel')
  })

  it('the middle button pans, and a finger only navigates once the Pencil has touched the map', () => {
    const { calls, handlers } = fake()
    const on = { x: 100, y: 100 }
    handlers.dragStart?.(drag(105, 100, on, 'mouse', 1))
    handlers.dragEnd?.(drag(105, 100, on, 'mouse', 1))
    handlers.hover?.({
      x: 0,
      y: 0,
      pointerType: 'pen',
      pressure: 0,
      tiltX: 0,
      tiltY: 0,
      modifiers: NO_KEYS,
    } as never)
    handlers.tap?.({ x: 100, y: 100, count: 1, pointerType: 'touch', modifiers: NO_KEYS })
    handlers.dragStart?.(drag(105, 100, on, 'touch'))
    handlers.dragEnd?.(drag(105, 100, on, 'touch'))
    expect(calls).toEqual(['pan 5,0', 'pan 5,0'])
  })

  it('two fingers pan and pinch, the wheel pans or zooms, and two- and three-finger taps undo and redo', () => {
    const { calls, handlers } = fake()
    handlers.pan?.({ dx: 3, dy: 4 } as never)
    handlers.pinch?.({ x: 50, y: 60, scale: 2 } as never)
    handlers.wheel?.({ mode: 'pan', dx: 1, dy: 2 } as never)
    handlers.wheel?.({ mode: 'zoom', x: 7, y: 8, scale: 0.5 } as never)
    handlers.multiTap?.({ fingers: 2 } as never)
    handlers.multiTap?.({ fingers: 3 } as never)
    expect(calls).toEqual(['pan 3,4', 'zoom 50,60 ×2', 'pan 1,2', 'zoom 7,8 ×0.5', 'undo', 'redo'])
  })
})
