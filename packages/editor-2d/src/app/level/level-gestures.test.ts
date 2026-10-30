import type {
  DragEndGesture,
  DragGesture,
  DragStartGesture,
  Modifiers,
  PointerKind,
} from '@mcthaydt/automata-editor-kit'
import { describe, expect, it } from 'vitest'
import { levelGestures, type LevelGestureTarget } from './level-gestures'

const keys: Modifiers = { shift: false, ctrl: false, alt: false, meta: false }

/** Records what each gesture did; level pixels are half the screen's (a camera at 200 %, origin at 0, 0). */
function setup() {
  const calls: string[] = []
  const target: LevelGestureTarget = {
    editor: {
      pointerDown: (at) => calls.push(`down ${at.x},${at.y}`),
      pointerMove: (at) => calls.push(`move ${at.x},${at.y}`),
      pointerUp: () => calls.push('up'),
      cancel: () => calls.push('cancel'),
    },
    toLevel: (point) => ({ x: point.x / 2, y: point.y / 2 }),
    panBy: (dx, dy) => calls.push(`pan ${dx},${dy}`),
    zoomAt: (point, factor) => calls.push(`zoom ${point.x},${point.y} ×${factor}`),
  }
  const handlers = levelGestures(target, {
    onundo: () => calls.push('undo'),
    onredo: () => calls.push('redo'),
  })
  return { calls, handlers }
}

function drag(x: number, y: number, kind: PointerKind, button = 0): DragGesture {
  return {
    x,
    y,
    startX: 10,
    startY: 10,
    dx: 2,
    dy: 4,
    pressure: 0.5,
    tiltX: 0,
    tiltY: 0,
    pointerType: kind,
    button,
    modifiers: keys,
  }
}
const start = (x: number, y: number, kind: PointerKind, button = 0): DragStartGesture => ({
  ...drag(x, y, kind, button),
  afterLongPress: false,
})
const end = (x: number, y: number, kind: PointerKind, cancelled = false, button = 0): DragEndGesture => ({
  ...drag(x, y, kind, button),
  cancelled,
})
const tap = (kind: PointerKind) => ({ x: 8, y: 6, count: 1, pointerType: kind, modifiers: keys })

describe('level gestures', () => {
  it('a tap is a press and a release at the level point', () => {
    const { calls, handlers } = setup()
    handlers.tap?.(tap('mouse'))
    expect(calls).toEqual(['down 4,3', 'up'])
  })

  it('a drag presses where it began, follows the pointer and releases', () => {
    const { calls, handlers } = setup()
    handlers.dragStart?.(start(14, 12, 'pen'))
    handlers.drag?.(drag(20, 16, 'pen'))
    handlers.dragEnd?.(end(22, 18, 'pen'))
    expect(calls).toEqual(['down 5,5', 'move 7,6', 'move 10,8', 'move 11,9', 'up'])
  })

  it('a cancelled drag cancels, so the stroke leaves nothing', () => {
    const { calls, handlers } = setup()
    handlers.dragStart?.(start(14, 12, 'touch'))
    handlers.dragEnd?.(end(16, 12, 'touch', true))
    expect(calls).toEqual(['down 5,5', 'move 7,6', 'cancel'])
  })

  it('a middle-button drag pans and edits nothing', () => {
    const { calls, handlers } = setup()
    handlers.dragStart?.(start(14, 12, 'mouse', 1))
    handlers.drag?.(drag(20, 16, 'mouse', 1))
    handlers.dragEnd?.(end(20, 16, 'mouse', false, 1))
    expect(calls).toEqual(['pan 2,4', 'pan 2,4'])
  })

  it('once a pen has drawn, a finger pans instead of drawing and its tap edits nothing', () => {
    const { calls, handlers } = setup()
    handlers.tap?.(tap('pen'))
    calls.length = 0
    handlers.dragStart?.(start(14, 12, 'touch'))
    handlers.drag?.(drag(20, 16, 'touch'))
    handlers.dragEnd?.(end(20, 16, 'touch'))
    handlers.tap?.(tap('touch'))
    expect(calls).toEqual(['pan 2,4', 'pan 2,4'])
  })

  it('a finger draws while no pen has been used', () => {
    const { calls, handlers } = setup()
    handlers.tap?.(tap('touch'))
    expect(calls).toEqual(['down 4,3', 'up'])
  })

  it('hover moves the brush footprint', () => {
    const { calls, handlers } = setup()
    handlers.hover?.({ x: 4, y: 8, pointerType: 'pen', pressure: 0, tiltX: 0, tiltY: 0, modifiers: keys })
    expect(calls).toEqual(['move 2,4'])
  })

  it('two fingers pan and pinch; the wheel zooms with Ctrl and pans without', () => {
    const { calls, handlers } = setup()
    handlers.pan?.({ phase: 'change', x: 0, y: 0, dx: 3, dy: -1, cancelled: false })
    handlers.pinch?.({
      phase: 'change',
      x: 50,
      y: 40,
      scale: 1.5,
      totalScale: 1.5,
      rotation: 0,
      totalRotation: 0,
      cancelled: false,
    })
    handlers.wheel?.({
      mode: 'zoom',
      x: 5,
      y: 6,
      dx: 0,
      dy: 0,
      scale: 1.25,
      modifiers: { ...keys, ctrl: true },
    })
    handlers.wheel?.({ mode: 'pan', x: 5, y: 6, dx: -7, dy: 9, scale: 1, modifiers: keys })
    expect(calls).toEqual(['pan 3,-1', 'zoom 50,40 ×1.5', 'zoom 5,6 ×1.25', 'pan -7,9'])
  })

  it('a two-finger tap undoes and a three-finger tap redoes', () => {
    const { calls, handlers } = setup()
    handlers.multiTap?.({ x: 0, y: 0, fingers: 2 })
    handlers.multiTap?.({ x: 0, y: 0, fingers: 3 })
    handlers.multiTap?.({ x: 0, y: 0, fingers: 4 })
    expect(calls).toEqual(['undo', 'redo'])
  })
})
