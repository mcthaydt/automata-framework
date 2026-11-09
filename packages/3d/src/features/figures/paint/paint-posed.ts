// A posed figure into its painted cell: the soup `soupOf` projected, the marks it placed, and the figure's own
// materials, neck and bends, handed to the painter.

import { type PaintedCell, paintCell } from './paint-cell.ts'
import { CELL_METRES, type PaintFigure, type PosedCell } from './soup.ts'

export function paintPosed(fig: PaintFigure, posed: PosedCell): PaintedCell {
  return paintCell({
    soup: posed.soup,
    decals: posed.decals,
    materials: fig.materials,
    face: posed.face,
    hands: posed.hands,
    bends: fig.bends,
    cell: posed.cell,
    feet: posed.feet,
    metres: CELL_METRES,
    neck: fig.neck,
    skin: fig.skin,
    ...(posed.cloth ? { cloth: posed.cloth } : {}),
  })
}
