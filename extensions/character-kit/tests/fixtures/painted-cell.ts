// A painted cell as the kit draws it: a figure stepped once under the view the camera gives it, for the placement tests.
import { paintView } from '#src/features/painted/place.ts'
import {
  type CameraPose,
  type CharacterDef,
  cellOf,
  Figure,
  member,
  type V3,
} from '#src/shared/figures/door.ts'

/** What the kit paints for `def` at `at` under `pose`: the figure the way `paintedFigure` draws it. */
export function painted(def: CharacterDef, pose: CameraPose, at: V3, density: 1 | 2 | 4 = 2) {
  const figure = new Figure(member(def, density))
  figure.update(1 / 60, { facing: 0, moving: false, view: paintView(pose, at) })
  return cellOf(figure)
}
