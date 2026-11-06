import type { Point } from '@mcthaydt/automata-content/level-2d'
import type { GestureHandlers } from '../../shared/kit/gestures/gesture-events.ts'
import type { PointerKind } from '../../shared/kit/gestures/pointer-sample.ts'
import type { LevelEditor } from './level-editor-api'
import type { LevelSession } from './level-session'

// What each gesture of the kit's recogniser does on the level canvas. One finger, the pen and the mouse's main button drive the tools through the level editor in level
// pixels; the middle button, two fingers and the wheel move the camera; a two-finger tap undoes and three fingers redo.
// Once a pen has been used on the canvas a finger only navigates (a drag pans, a tap does nothing), so a hand resting
// or steadying the view never paints. A plain function of the session, so the mapping is a unit test and the view only
// attaches it.

export interface LevelGestureTarget extends Pick<LevelSession, 'toLevel' | 'panBy' | 'zoomAt'> {
  readonly editor: Pick<LevelEditor, 'pointerDown' | 'pointerMove' | 'pointerUp' | 'cancel'>
}

export interface LevelHistoryGestures {
  readonly onundo: () => void
  readonly onredo: () => void
}

const MIDDLE_BUTTON = 1

export function levelGestures(target: LevelGestureTarget, history: LevelHistoryGestures): GestureHandlers {
  const { editor } = target
  let penUsed = false
  /** The open drag moves the camera instead of the tool. */
  let panning = false

  const at = (x: number, y: number): Point => target.toLevel({ x, y })
  const seen = (kind: PointerKind): void => {
    if (kind === 'pen') penUsed = true
  }
  const navigatesOnly = (kind: PointerKind, button: number): boolean =>
    button === MIDDLE_BUTTON || (kind === 'touch' && penUsed)

  return {
    tap(event) {
      seen(event.pointerType)
      if (navigatesOnly(event.pointerType, 0)) return
      editor.pointerDown(at(event.x, event.y))
      editor.pointerUp()
    },
    hover(event) {
      seen(event.pointerType)
      editor.pointerMove(at(event.x, event.y))
    },
    dragStart(event) {
      seen(event.pointerType)
      panning = navigatesOnly(event.pointerType, event.button)
      if (panning) return target.panBy(event.dx, event.dy)
      editor.pointerDown(at(event.startX, event.startY))
      editor.pointerMove(at(event.x, event.y))
    },
    drag(event) {
      if (panning) return target.panBy(event.dx, event.dy)
      editor.pointerMove(at(event.x, event.y))
    },
    dragEnd(event) {
      if (panning) {
        panning = false
        return
      }
      if (event.cancelled) return editor.cancel()
      editor.pointerMove(at(event.x, event.y))
      editor.pointerUp()
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
