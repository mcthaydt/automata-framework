// What a hanging garment shares: a tube that rides the pelvis and follows the thighs below it (a skirt, a coat, an
// apron), and a band round the waist (a belt).
//
// Extracted from FigureBuilder (mcthaydt/FigureBuilder) src/render/figure/garments.ts at a1f7246 (`hang`, `band`), with
// AF's strict types; the formulas and their order are the source's.

import { hemWeights, J, type Part, tube, weights } from '@automata/3d/figures-kit'

/**
 * A tube from `top` to `bottom` (heights above the floor), riding the pelvis and following the thighs below.
 */
export function hang(
  material: string,
  group: number,
  top: number,
  bottom: number,
  o: {
    waist: number
    hem: number
    depth?: number
    belly?: number
    follow?: number
    arc?: [number, number]
    folds?: [number, number]
    seg?: number
  },
): Part {
  const mesh = tube(
    [top, o.waist, o.waist * (o.depth ?? 0.8), 0],
    [bottom, o.hem, o.hem * (o.depth ?? 0.8), 0.01],
    {
      belly: o.belly ?? 0.04,
      seg: o.seg ?? 24,
      rings: 5,
      arc: o.arc,
      folds: o.folds,
    },
  )
  return {
    mesh,
    material,
    group,
    skin: hemWeights(mesh, J.pelvis, J['thigh.L'], J['thigh.R'], top - 0.05, bottom, o.follow ?? 0.75, o.hem),
  }
}

/** A ring round the trunk `height` tall at `y`, carried by the pelvis. */
export const band = (
  material: string,
  group: number,
  y: number,
  height: number,
  rx: number,
  rz: number,
): Part => {
  const mesh = tube([y + height / 2, rx, rz, 0], [y - height / 2, rx, rz, 0], { seg: 18, rings: 1 })
  return { mesh, material, group, skin: weights(mesh, () => [[J.pelvis, 1]]) }
}
