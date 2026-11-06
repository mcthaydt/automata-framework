import type { Point } from '../../shared/kit/fields/field-types.ts'
import type { GestureHandlers } from '../../shared/kit/gestures/gesture-events.ts'
import type { PointerKind } from '../../shared/kit/gestures/pointer-sample.ts'
import type { WorldDrag } from './world-drag'

// What each gesture of the kit's recogniser does on the World view's map (plan ED2D.8a decision 1; 2D editor spec §8
// flow 7, §12), the Level view's mapping (`level-gestures.ts`) for levels instead of tools. A tap selects the level under
// it (or clears the selection); a drag that starts on a level moves it through ED2D.6b's `WorldDrag`, one undo step; a
// drag on empty space, the middle button, two fingers and the wheel move the camera, and a pinch or Ctrl/Meta+wheel
// zooms. Once a pen has touched the map a finger only navigates, so a resting hand never moves a level. Two- and
// three-finger taps undo and redo.

export interface WorldGestureTarget {
  /** The level under a point on the map (screen pixels), if any. */
  levelAt(screen: Point): string | undefined
  readonly drag: WorldDrag
  panBy(dx: number, dy: number): void
  zoomAt(point: Point, factor: number): void
}

export interface WorldHistoryGestures {
  readonly onundo: () => void
  readonly onredo: () => void
}

const MIDDLE_BUTTON = 1

export function worldGestures(target: WorldGestureTarget, history: WorldHistoryGestures): GestureHandlers {
  const { drag } = target
  let penUsed = false
  /** The open drag moves the camera instead of a level. */
  let panning = false

  const seen = (kind: PointerKind): void => {
    if (kind === 'pen') penUsed = true
  }
  const navigatesOnly = (kind: PointerKind, button: number): boolean =>
    button === MIDDLE_BUTTON || (kind === 'touch' && penUsed)

  return {
    tap(event) {
      seen(event.pointerType)
      if (navigatesOnly(event.pointerType, 0)) return
      drag.down({ x: event.x, y: event.y })
      drag.up()
    },
    hover(event) {
      seen(event.pointerType)
    },
    dragStart(event) {
      seen(event.pointerType)
      const start = { x: event.startX, y: event.startY }
      panning = navigatesOnly(event.pointerType, event.button) || target.levelAt(start) === undefined
      if (panning) return target.panBy(event.dx, event.dy)
      drag.down(start)
      drag.move({ x: event.x, y: event.y })
    },
    drag(event) {
      if (panning) return target.panBy(event.dx, event.dy)
      drag.move({ x: event.x, y: event.y })
    },
    dragEnd(event) {
      if (panning) {
        panning = false
        return
      }
      if (event.cancelled) return drag.cancel()
      drag.move({ x: event.x, y: event.y })
      drag.up()
    },
    pan: (event) => target.panBy(event.dx, event.dy),
    pinch: (event) => target.zoomAt({ x: event.x, y: event.y }, event.scale),
    wheel(event) {
      if (event.mode === 'zoom') target.zoomAt({ x: event.x, y: event.y }, event.scale)
      else target.panBy(event.dx, event.dy)
    },
    multiTap(event) {
      if (event.fingers === 2) history.onundo()
      else if (event.fingers === 3) history.onredo()
    },
  }
}
