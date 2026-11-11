// Which view the player is in: a zone is its view's `bounds` (the room's footprint on the floor), and a player enters
// another zone only `enterMargin` metres inside it, so standing on a threshold does not cut the camera back and forth
// (the reference's `enter`, 0.25 m). Integer-free arithmetic only (comparisons and one subtraction), so a game's sim
// may call it.
import type { CameraView } from './camera-view.schema.ts'

/** A point on the floor, in metres. */
export interface FloorPoint {
  readonly x: number
  readonly z: number
}

/** Whether `point` is inside `view`'s footprint, shrunk by the view's enter margin on every side. */
const entered = (view: CameraView, point: FloorPoint): boolean => {
  const { bounds, enterMargin } = view
  if (bounds === undefined) return false
  return (
    point.x >= bounds.min[0] + enterMargin &&
    point.x <= bounds.max[0] - enterMargin &&
    point.z >= bounds.min[2] + enterMargin &&
    point.z <= bounds.max[2] - enterMargin
  )
}

/**
 * The view for the player at `point`, who is now in `current`: the first other view whose zone the player is
 * `enterMargin` inside, else `current` (a player between zones, or off every zone, keeps the view they have).
 */
export function viewAt(
  views: readonly CameraView[],
  point: FloorPoint,
  current: string | undefined,
): CameraView | undefined {
  const entering = views.find((view) => view.id !== current && entered(view, point))
  return entering ?? views.find((view) => view.id === current)
}
