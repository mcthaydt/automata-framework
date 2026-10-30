// What each gesture of the kit's recogniser does on the plan (ED3D.5d; ED3D spec §10). Taps, drags and hovers go to the
// Select tool's controller with the pointer's kind and keys (the controller decides what a Pencil may not do: it never
// pans); two fingers and the wheel move the camera; a two-finger tap undoes and a three-finger tap redoes. A plain
// function of the controller, so the mapping is a unit test and the canvas only attaches it.
import type { GestureHandlers, Modifiers, PointerKind } from '@mcthaydt/automata-editor-kit'
import type { PlanController, PlanPointer } from '../../app/plan-controller'

export interface PlanHistoryGestures {
  readonly onundo: () => void
  readonly onredo: () => void
}

const pointer = (x: number, y: number, kind: PointerKind, keys: Modifiers): PlanPointer => ({
  x,
  y,
  kind,
  shift: keys.shift,
  alt: keys.alt,
  additive: keys.ctrl || keys.meta,
})

export function planGestures(controller: PlanController, history: PlanHistoryGestures): GestureHandlers {
  return {
    tap: (event) => controller.tap(pointer(event.x, event.y, event.pointerType, event.modifiers)),
    hover: (event) => controller.hover(pointer(event.x, event.y, event.pointerType, event.modifiers)),
    dragStart: (event) =>
      controller.dragStart(
        pointer(event.startX, event.startY, event.pointerType, event.modifiers),
        pointer(event.x, event.y, event.pointerType, event.modifiers),
      ),
    drag: (event) => controller.drag(pointer(event.x, event.y, event.pointerType, event.modifiers)),
    dragEnd: (event) =>
      controller.dragEnd(pointer(event.x, event.y, event.pointerType, event.modifiers), event.cancelled),
    pan: (event) => controller.panBy(event.dx, event.dy),
    pinch: (event) => controller.zoomAt({ x: event.x, y: event.y }, event.scale),
    wheel: (event) => {
      if (event.mode === 'zoom') controller.zoomAt({ x: event.x, y: event.y }, event.scale)
      else controller.panBy(event.dx, event.dy)
    },
    multiTap: (event) => {
      if (event.fingers === 2) history.onundo()
      else if (event.fingers === 3) history.onredo()
    },
  }
}
