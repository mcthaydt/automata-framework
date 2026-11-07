// A figure's point marks (the eyes, buttons, zips, stitches) as small quads on their bones (M3 spec §4.4.1 "Faces":
// the source's point decals become small textured quads on the head, shown only when facing the camera). Each quad
// is wound to face along its decal's normal, so the material's back-face culling hides it when it is turned away:
// that is the "shown only toward the camera" rule, with no per-frame test.
import { cross, normalize, type V3 } from '../../../shared/math/math.ts'
import type { Decal } from '../body/mesh.ts'
import { FIGURE_PPM } from '../body/texels.ts'

/** One decal's quad, in its bone's space. */
export interface DecalQuad {
  readonly bone: number
  readonly material: string
  readonly positions: Float32Array
  readonly normals: Float32Array
  readonly indices: Uint16Array
}

/** How far a quad sits off its surface along the normal (m): enough to win the depth test against it. */
const LIFT = 0.0005

/**
 * The neutral face's decals as quads: those with no `when` list or one naming `neutral`, and not the blink's lids.
 * The other face states (an expression, a blink, an open mouth) are clips' to drive (M3.6d).
 */
export function decalQuads(decals: readonly Decal[]): DecalQuad[] {
  return decals
    .filter((d) => (d.when === undefined || d.when.includes('neutral')) && d.blink !== true)
    .map(quadOf)
}

function quadOf(decal: Decal): DecalQuad {
  const n = normalize(decal.normal)
  // Across and up in the decal's plane, with across × up = n, so the corners below wind counter-clockwise seen
  // from the normal's side (the front face).
  const hint: V3 = Math.abs(n[1]) > 0.9 ? [0, 0, -1] : [0, 1, 0]
  const across = normalize(cross(hint, n))
  const up = cross(n, across)
  const [wide, high] = decal.size ?? [1, 1]
  const hw = wide / FIGURE_PPM / 2
  const hh = high / FIGURE_PPM / 2
  const centre: V3 = [decal.at[0] + n[0] * LIFT, decal.at[1] + n[1] * LIFT, decal.at[2] + n[2] * LIFT]
  const corner = (a: number, u: number): V3 => [
    centre[0] + across[0] * a * hw + up[0] * u * hh,
    centre[1] + across[1] * a * hw + up[1] * u * hh,
    centre[2] + across[2] * a * hw + up[2] * u * hh,
  ]
  return {
    bone: decal.bone,
    material: decal.material,
    positions: new Float32Array([...corner(-1, -1), ...corner(1, -1), ...corner(1, 1), ...corner(-1, 1)]),
    normals: new Float32Array([...n, ...n, ...n, ...n]),
    indices: new Uint16Array([0, 1, 2, 0, 2, 3]),
  }
}
