// What each gesture of the kit's recogniser does on the plan (ED3D.5d, ED3D.6g-a; ED3D spec §10). Taps, drags and hovers
// go to the active tool with the pointer's kind and keys (the tools decide what a Pencil may not do: it never pans); two
// fingers and the wheel move the camera through Select, whatever the tool; a two-finger tap undoes and a three-finger tap redoes. A plain
// function of the controller, so the mapping is a unit test and the canvas only attaches it.
import type { GestureHandlers, Modifiers, PointerKind } from '@automata/editor/kit'
import type { PlanPointer } from './plan-controller'
import type { PlanTools } from './plan-tools'

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

/** What the gestures drive: the active tool's pointer, and Select's camera. */
export type PlanGestureTarget = Pick<PlanTools, 'hover' | 'tap' | 'dragStart' | 'drag' | 'dragEnd'> & {
  readonly select: Pick<PlanTools['select'], 'panBy' | 'zoomAt'>
}

export function planGestures(tools: PlanGestureTarget, history: PlanHistoryGestures): GestureHandlers {
  const camera = tools.select
  return {
    tap: (event) => tools.tap(pointer(event.x, event.y, event.pointerType, event.modifiers)),
    hover: (event) => tools.hover(pointer(event.x, event.y, event.pointerType, event.modifiers)),
    dragStart: (event) =>
      tools.dragStart(
        pointer(event.startX, event.startY, event.pointerType, event.modifiers),
        pointer(event.x, event.y, event.pointerType, event.modifiers),
      ),
    drag: (event) => tools.drag(pointer(event.x, event.y, event.pointerType, event.modifiers)),
    dragEnd: (event) =>
      tools.dragEnd(pointer(event.x, event.y, event.pointerType, event.modifiers), event.cancelled),
    pan: (event) => camera.panBy(event.dx, event.dy),
    pinch: (event) => camera.zoomAt({ x: event.x, y: event.y }, event.scale),
    wheel: (event) => {
      if (event.mode === 'zoom') camera.zoomAt({ x: event.x, y: event.y }, event.scale)
      else camera.panBy(event.dx, event.dy)
    },
    multiTap: (event) => {
      if (event.fingers === 2) history.onundo()
      else if (event.fingers === 3) history.onredo()
    },
  }
}
