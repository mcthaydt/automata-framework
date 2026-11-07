// What the figure is built of: meshes, the parts that carry them (rigid on one bone, or skinned to several),
// and the point marks laid on them. Every part names its material, a swatch id or a variant of one
// (build/materials.ts), which the view draws in a palette colour.
//
// Extracted from FigureBuilder (mcthaydt/FigureBuilder) src/render/figure/parts.ts at a1f7246: `Mesh`,
// `Part`, `Decal`, `GROUP`, `placed`. Cut: the painter's `Material` (DUEL ramps and tones; AF's materials are
// palette colours) and the decal's `density` and `print` (sprite densities and prints). `vertexAt` and
// `sgnPow` are small helpers the source wrote inline.

import type { MeshData } from '../../../shared/math/geometry.ts'
import type { V3 } from '../../../shared/math/math.ts'

export { placed, sgnPow, vertexAt } from '../../../shared/math/geometry.ts'

/** The plain triple a part is built of: shared with the world's pieces (`shared/math/geometry.ts`). */
export type Mesh = MeshData

/**
 * The figure's part groups: what moves and outlines as one (the trunk, the head and hair, each limb, a held
 * item).
 */
export const GROUP: {
  readonly torso: 0
  readonly head: 1
  readonly hair: 1
  readonly armL: 3
  readonly armR: 4
  readonly legL: 5
  readonly legR: 6
  readonly item: 7
  readonly skirt: 8
  readonly cape: 9
} = { torso: 0, head: 1, hair: 1, armL: 3, armR: 4, legL: 5, legR: 6, item: 7, skirt: 8, cape: 9 }

/** One bone's share of a skinned vertex: [joint index, weight]. */
export type Weight = [joint: number, weight: number]

export interface Part {
  mesh: Mesh
  /** A swatch id, or a variant of one (`<swatch>@<role>`, build/materials.ts). */
  material: string
  /** Parts in the same group never draw an inner contour line between them. */
  group: number
  /** Rigid: the bone whose space the mesh is in. */
  bone?: number
  /** Skinned: per vertex, its bones and weights (summing to 1); the mesh is in rest figure space. */
  skin?: Weight[][]
  /** A tag: `crown` on the hair's top and a cap's dome (what is worn up on the head lies on them). */
  tag?: string
  /** Parts sharing a seam number are one surface built from several pieces. */
  seam?: number
}

/** A point mark (an eye, a button, a zip's tooth): drawn where its surface faces the camera. */
export interface Decal {
  bone: number
  at: V3
  normal: V3
  material: string
  /** Its size in texels at the fixed ppm (parts/texels.ts), across and down; one texel when left out. */
  size?: [number, number]
  tag?: string
  /** Facial marks: the face states (an expression, or 'mouthOpen') it shows in; always when left out. */
  when?: string[]
  /** true: only while the eyes blink; false: never while they do. */
  blink?: boolean
}
