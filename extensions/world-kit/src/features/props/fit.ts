// A prop drawn at a size: any generator of the kit, built as it would be (turned about y first, if asked) and then scaled,
// axis by axis, to fill the box the place gives, standing on its base and centred on its origin. The clinic uses it to put
// the kit's own bed, cabinet or plant in the box the source's model filled, without a size parameter on every generator.
import {
  type Built,
  type Generator,
  isFault,
  type MeshData,
  type PropLight,
  resolveProp,
  type V3,
  type WorldLibrary,
} from '@automata/3d/props-kit'
import { boundsOfMesh } from '../../shared/piece-helpers.ts'
import { turnY } from '../../shared/turn.ts'

/**
 * `of` is a generator's kind and `with` its parameters; `size` is the box to fill (x, up, z) and `turn` the degrees about y
 * the prop is turned before it is measured (a bed built lengthwise along x, turned a quarter, lies along z). A part's
 * normals follow the scale, so a stretched face keeps facing the way it did.
 */
const fit: Generator = (p) => {
  const resolved = resolveProp({ kind: p.of, with: p.with }, {} as WorldLibrary)
  if (isFault(resolved)) throw new Error(`fit: "${p.of}" is not a prop generator (${resolved.code})`)
  const inner: Built = resolved.generator(resolved.params)
  const turn = (p.turn as number | undefined) ?? 0
  const turned = inner.pieces.map((piece) => ({
    ...piece,
    mesh: turn === 0 ? piece.mesh : turnY(piece.mesh, turn),
  }))
  const [lo, hi] = boundsOfMesh(turned.map((piece) => piece.mesh)) ?? [[0, 0, 0] as V3, [0, 0, 0] as V3]
  const size = p.size as V3
  const scale = [0, 1, 2].map((k) => {
    const have = (hi[k] as number) - (lo[k] as number)
    return have > 1e-9 ? (size[k] as number) / have : 1
  }) as V3
  const cx = ((lo[0] as number) + (hi[0] as number)) / 2
  const cz = ((lo[2] as number) + (hi[2] as number)) / 2
  const point = (x: number, y: number, z: number): V3 => [
    (x - cx) * (scale[0] as number),
    (y - (lo[1] as number)) * (scale[1] as number),
    (z - cz) * (scale[2] as number),
  ]
  const fitted = (mesh: MeshData): MeshData => {
    const positions = new Array<number>(mesh.positions.length)
    const normals = new Array<number>(mesh.normals.length)
    for (let i = 0; i < mesh.positions.length; i += 3) {
      const at = point(
        mesh.positions[i] as number,
        mesh.positions[i + 1] as number,
        mesh.positions[i + 2] as number,
      )
      positions[i] = at[0]
      positions[i + 1] = at[1]
      positions[i + 2] = at[2]
      // The normal of a stretched surface scales by the inverse.
      const n = [0, 1, 2].map((k) => (mesh.normals[i + k] as number) / (scale[k] as number))
      const length = Math.hypot(n[0] as number, n[1] as number, n[2] as number) || 1
      normals[i] = (n[0] as number) / length
      normals[i + 1] = (n[1] as number) / length
      normals[i + 2] = (n[2] as number) / length
    }
    return { ...mesh, positions, normals }
  }
  const lights: PropLight[] | undefined = inner.lights?.map((light) => {
    const at =
      turn === 0
        ? light.at
        : (turnY({ positions: [...light.at], normals: [0, 1, 0], indices: [] }, turn).positions as number[])
    return { ...light, at: point(at[0] as number, at[1] as number, at[2] as number) }
  })
  return {
    pieces: turned.map((piece) => ({ ...piece, mesh: fitted(piece.mesh) })),
    ...(lights === undefined ? {} : { lights }),
  }
}

export const FIT: Readonly<Record<string, Generator>> = { fit }
