// A bun: one rope wound in a flattened spiral about the direction `at` (a disc standing off the skull, its coils fused into
// a mass by their own thickness), from its outer edge in to near its middle, rising along `at` as it goes in, so it
// domes. Its root rides the head's form (`toHead`) and the whole of it lies outside it, a rope's radius and a little over.
// `flat` (default 0.6) is how deep it lies, of its width; `turns` (default 2.5) how many times it winds.
//
// Ported from the figure code this kit grew out of (`hairParts`'s `bun`), with
// AF's strict types; the formulas and their order are the source's.

import {
  add,
  alignY,
  cross,
  type HairBuild,
  J,
  normalize,
  type Rope,
  ropeSchema,
  scale,
  smooth,
  superquadric,
  sweep,
  texels,
  tieSchema,
  toHead,
  type V3,
  type Vec3,
  vec3,
} from '@automata/3d/figures-kit'
import { z } from 'zod'
import type { KitPiece } from './kit-piece.ts'

export interface Bun {
  readonly at: Vec3
  readonly r: number
  /** How deep it lies, of its width (default 0.6). */
  readonly flat?: number | undefined
  /** How many times it winds (default 2.5). */
  readonly turns?: number | undefined
  readonly rope: Rope
  readonly tie?: boolean | string | undefined
}

const n = z.number()

const schema: z.ZodType<Bun> = z.strictObject({
  at: vec3,
  r: n,
  flat: n.optional(),
  turns: n.optional(),
  rope: ropeSchema,
  tie: tieSchema.optional(),
})

function build(b: HairBuild, o: Bun): void {
  const { k, form, hw, parts } = b
  const dir = normalize(o.at)
  const root = toHead(form, k, dir, 0)
  const R = o.r * hw
  const ra = o.rope.r * hw
  const turns = o.turns ?? 2.5
  const flat = o.flat ?? 0.6
  const u = normalize(cross(dir, Math.abs(dir[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]))
  const w = cross(dir, u)
  const lift = ra * 1.5
  const n = Math.max(24, Math.round(turns * 24))
  // A disc `flat` of its width deep: the coils rise from `lift` at the rim to `flat * R` at the middle.
  const spiral = (q: number): V3 => {
    const th = 2 * Math.PI * turns * q
    const rho = R * (1 - 0.8 * q)
    const h = lift + flat * R * smooth(q)
    return add(root, add(scale(u, Math.cos(th) * rho), add(scale(w, Math.sin(th) * rho), scale(dir, h))))
  }
  const path = Array.from({ length: n + 1 }, (_, i) => spiral(i / n))
  const { mesh, lit } = sweep(path, { tip: 'round', ...o.rope }, hw, () => dir)
  b.rigid(mesh, 'hair', b.nextSeam(), lit)
  // The tie: a band, not a cord, a little proud of the coil's middle, a whole texel tall.
  const band = b.tieOf(o.tie)
  if (band)
    parts.push({
      bone: J.head,
      mesh: superquadric({
        at: add(root, scale(dir, lift * 0.8)),
        r: [R * 0.45, texels(0.04 * b.input.s.genes.head) / 2, R * 0.45],
        e: [0.25, 1],
        seg: 14,
        rings: 4,
        turn: alignY(dir),
      }),
      material: band,
      group: 1,
      seam: b.nextSeam(),
    })
}

export const BUN: KitPiece = { kind: 'bun', piece: { schema, build, crown: true } }
