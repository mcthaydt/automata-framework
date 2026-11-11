// A model fitted to the box a prop stands in. A model's file has its own origin and scale and faces +z; a prop's origin is
// the centre of its base and its size is in metres, so the fit puts the model's bounds on that box (scaled to each side of
// `size`, or to its height alone when `uniform` keeps its proportions), then turns it about the prop's origin the way a
// place turns its pieces and moves it there. Plain arrays in, plain arrays out: the renderer builds its geometry from them.
/** A model's mesh as the fit reads it: what `ModelMesh` holds, bounds included. */
export interface FitMesh {
  readonly positions: Float32Array
  readonly normals: Float32Array
  readonly uvs: Float32Array
  readonly indices: Uint16Array | Uint32Array
  readonly min: readonly [number, number, number]
  readonly max: readonly [number, number, number]
}

/** How a model fills its prop's box. */
export interface ModelFit {
  /** `[width, height, depth]` in metres, in the prop's own space (before the turn). */
  readonly size: readonly [number, number, number]
  /** Scale by `size`'s height alone, so the model keeps its proportions. */
  readonly uniform?: boolean | undefined
  /** Flip the model along x. */
  readonly mirror?: boolean | undefined
}

/** Where the prop stands: its base centre `[x, up, z]` and its turn in degrees about y (a place's `90 − angle`). */
export interface ModelPlace {
  readonly at: readonly [number, number, number]
  readonly turn: number
}

export interface FittedModel {
  readonly positions: Float32Array
  readonly normals: Float32Array
  readonly uvs: Float32Array
  readonly indices: Uint16Array | Uint32Array
}

/** `numerator / denominator`, or 1 for a side the model does not have (a flat model keeps that side as it is). */
const ratio = (numerator: number, denominator: number): number =>
  denominator > 1e-9 ? numerator / denominator : 1

export function fitModelMesh(mesh: FitMesh, fit: ModelFit, place: ModelPlace): FittedModel {
  const extent = [0, 1, 2].map((k) => (mesh.max[k] as number) - (mesh.min[k] as number))
  const height = ratio(fit.size[1], extent[1] as number)
  const scale =
    fit.uniform === true ? [height, height, height] : fit.size.map((s, k) => ratio(s, extent[k] as number))
  const flip = fit.mirror === true ? -1 : 1
  const [sx, sy, sz] = [(scale[0] as number) * flip, scale[1] as number, scale[2] as number]
  const centre = [(mesh.min[0] + mesh.max[0]) / 2, mesh.min[1], (mesh.min[2] + mesh.max[2]) / 2] as const
  const c = Math.cos((place.turn * Math.PI) / 180)
  const s = Math.sin((place.turn * Math.PI) / 180)
  const positions = new Float32Array(mesh.positions.length)
  const normals = new Float32Array(mesh.normals.length)
  for (let i = 0; i < mesh.positions.length; i += 3) {
    const x = ((mesh.positions[i] as number) - centre[0]) * sx
    const y = ((mesh.positions[i + 1] as number) - centre[1]) * sy
    const z = ((mesh.positions[i + 2] as number) - centre[2]) * sz
    positions[i] = c * x + s * z + place.at[0]
    positions[i + 1] = y + place.at[1]
    positions[i + 2] = -s * x + c * z + place.at[2]
    // A normal moves by the inverse scale, then is made a unit again.
    const nx = (mesh.normals[i] as number) / sx
    const ny = (mesh.normals[i + 1] as number) / sy
    const nz = (mesh.normals[i + 2] as number) / sz
    const length = Math.hypot(nx, ny, nz) || 1
    normals[i] = (c * nx + s * nz) / length
    normals[i + 1] = ny / length
    normals[i + 2] = (-s * nx + c * nz) / length
  }
  // A mirror turns every triangle inside out; swapping two corners turns it back.
  const indices = mesh.indices.slice()
  if (sx * sy * sz < 0)
    for (let t = 0; t < indices.length; t += 3) {
      const b = indices[t + 1] as number
      indices[t + 1] = indices[t + 2] as number
      indices[t + 2] = b
    }
  return { positions, normals, uvs: mesh.uvs, indices }
}
