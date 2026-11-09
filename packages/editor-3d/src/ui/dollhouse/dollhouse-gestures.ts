// What each gesture of the kit's recogniser does in the dollhouse (ED3D.5e, plan decision 2; ED3D spec §10): one finger,
// the mouse or the Pencil orbits; a pinch zooms and its twist turns (the canvas attaches with `rotate`); the wheel
// zooms, or orbits when it scrolls; a tap selects; a two-finger tap undoes and a three-finger tap redoes. A plain
// function of the controller, so the mapping is a unit test and the canvas only attaches it.
import type { GestureHandlers } from '@automata/editor/kit'
import type { DollhouseController } from '../../app/dollhouse-controller'

export interface DollhouseHistoryGestures {
  readonly onundo: () => void
  readonly onredo: () => void
}

export function dollhouseGestures(
  controller: Pick<DollhouseController, 'orbitBy' | 'zoomBy' | 'twist' | 'tap'>,
  history: DollhouseHistoryGestures,
): GestureHandlers {
  return {
    tap: (event) => controller.tap({ x: event.x, y: event.y, kind: event.pointerType }),
    dragStart: (event) => controller.orbitBy(event.dx, event.dy),
    drag: (event) => controller.orbitBy(event.dx, event.dy),
    dragEnd: (event) => controller.orbitBy(event.dx, event.dy),
    pinch: (event) => {
      controller.zoomBy(event.scale)
      if (event.rotation !== 0) controller.twist(event.rotation)
    },
    wheel: (event) => {
      if (event.mode === 'zoom') controller.zoomBy(event.scale)
      else controller.orbitBy(event.dx, event.dy)
    },
    multiTap: (event) => {
      if (event.fingers === 2) history.onundo()
      else if (event.fingers === 3) history.onredo()
    },
  }
}
