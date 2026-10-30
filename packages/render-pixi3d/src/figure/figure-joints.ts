// A figure's joint containers take each joint's world matrix from `fk` (the figures package's row-major rotation and
// translation, figure space). The containers sit flat under the figure's node, so the matrix is set as their local
// transform directly.
import { type M, matq, rotationOf } from '@mcthaydt/automata-figures'
import type { Container3D } from '@pixi/3d'

/** Moves and turns `node` to the joint matrix `m`. */
export function placeJoint(node: Container3D, m: M): void {
  const [x, y, z, w] = matq(rotationOf(m))
  node.position.set(m[9], m[10], m[11])
  node.quaternion.set(x, y, z, w)
}
