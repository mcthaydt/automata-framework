// What a painted figure gives the room's cast shadow (`SceneLight.shadows`, in `@automataframework/3d`): the opaque texels of the cell
// the painter drew, with how big a texel is and where the feet are in it, and which way the picture's right runs on the floor.
// The room supplies the sun, the floors and the look's switch; the figure knows only its picture.
import type { FigureShadowInput } from '@automataframework/3d'
import type { Cell, V3 } from '../../shared/figures/door.ts'

/** The part of a cell a shadow reads. */
type Picture = Pick<Cell, 'key' | 'size' | 'rgba' | 'anchor' | 'metresPerTexel' | 'pitch'>

/** Under this the picture's right has no horizontal part (a camera looking straight down): the shadow's grid then runs along x. */
const FLAT = 1e-6

/**
 * The shadow input for `cell` standing at `at`, with the camera's right as `right` (a unit vector in the world: the stage's
 * `pose.right`). Only its horizontal part counts, turned to a unit vector.
 */
export function shadowInput(cell: Picture, at: V3, right: V3): FigureShadowInput {
  const length = Math.hypot(right[0], right[2])
  return {
    silhouette: {
      key: cell.key,
      width: cell.size[0],
      height: cell.size[1],
      rgba: cell.rgba,
      anchor: cell.anchor,
      metresPerTexel: cell.metresPerTexel,
      pitch: cell.pitch,
    },
    at,
    right: length > FLAT ? [right[0] / length, right[2] / length] : [1, 0],
  }
}
