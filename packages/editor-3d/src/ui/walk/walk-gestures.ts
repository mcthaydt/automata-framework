// What each gesture of the kit's recogniser does in the Walk view (ED3D.8b; ED3D spec §10): a tap picks what the crosshair is
// on (the crosshair is the pick, so a tap anywhere is the same pick); a finger or the mouse dragging looks; the Pencil never
// moves the camera, so a hand steadied on the glass with a Pencil in the other cannot turn the view; a two-finger tap
// undoes and a three-finger tap redoes. A plain function of the controller, so the mapping is a unit test.
import type { GestureHandlers } from '@automata/editor/kit'
import type { WalkController } from '../../app/walk-session'

/** Radians a pixel of drag turns the view: a drag across a 600 px view turns it about a half turn. */
const RADIANS_PER_PIXEL = 0.005

export function walkGestures(
  walk: Pick<WalkController, 'lookBy' | 'pick'>,
  history: { readonly onundo: () => void; readonly onredo: () => void },
): GestureHandlers {
  const look = (event: { readonly dx: number; readonly dy: number; readonly pointerType: string }): void => {
    if (event.pointerType === 'pen') return
    walk.lookBy(event.dx * RADIANS_PER_PIXEL, -event.dy * RADIANS_PER_PIXEL)
  }
  return {
    tap: () => walk.pick(),
    dragStart: look,
    drag: look,
    multiTap: (event) => {
      if (event.fingers === 2) history.onundo()
      else if (event.fingers === 3) history.onredo()
    },
  }
}
