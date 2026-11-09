// Skin weights: which bones carry each vertex of a skinned part, and how much (summing to 1). The view blends the bones'
// transforms by them (linear blend skinning on the CPU). Not taken: `drapeWeights` (nothing builds with it).

import { smooth } from '../../../shared/math/math.ts'
import { type Mesh, vertexAt, type Weight } from './mesh.ts'

/** How a vertex at a rest position is carried. */
export type SkinOf = (x: number, y: number, z: number) => Weight[]

/** Skin weights from a function of each rest position. */
export function weights(mesh: Mesh, f: SkinOf): Weight[][] {
  const out: Weight[][] = []
  for (let i = 0; i < mesh.positions.length / 3; i++) out.push(f(...vertexAt(mesh.positions, i)))
  return out
}

/**
 * Skin weights for a hem: the top ring rides `top`; lower down, each vertex follows the thigh on its side.
 */
export function hemWeights(
  mesh: Mesh,
  top: number,
  thighL: number,
  thighR: number,
  from: number,
  to: number,
  follow: number,
  width: number,
): Weight[][] {
  return weights(mesh, (x, y) => {
    const down = smooth((from - y) / (from - to)) * follow
    const left = smooth((x / width + 0.4) / 0.8)
    return [
      [top, 1 - down],
      [thighL, down * left],
      [thighR, down * (1 - left)],
    ]
  })
}

/**
 * Skin weights for a trouser leg's hem (wide-legs, cargos): `leg` the leg's own skin (pelvis, thigh, shin);
 * from `from` (a height on the shin, the knee's or under it) down to `hemY` a share of it, rising smoothly to
 * `share` at the hem, goes to the leg's hem joint `hem` (J.hemL / J.hemR). The motion places that
 * joint each frame between the ankle and the plumb under the hip, upright: on the floor while the foot is
 * planted, so the hem hangs and pools rather than swinging rigid with the shin; with the foot as it lifts, so
 * it rides up over a trailing shoe.
 */
export function hemSkin(
  leg: (x: number, y: number, z?: number) => Weight[],
  hem: number,
  from: number,
  hemY: number,
  share = 1,
): (x: number, y: number, z?: number) => Weight[] {
  return (x, y, z) => {
    const w = share * smooth((from - y) / Math.max(1e-6, from - hemY))
    return [...leg(x, y, z).map(([bone, v]): Weight => [bone, v * (1 - w)]), [hem, w]]
  }
}
