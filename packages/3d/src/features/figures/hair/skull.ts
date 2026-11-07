// The skull's frame for hair and headwear. A style's head units (heights, angles round the head, sizes of its
// half-width) are about a rounded box round the head; what fits the head (a scalp, a row's line, a fall's
// root, a cap's dome) fits the head's own form (garments/head.ts), so a style and a cap hug the round
// cranium.
//
// Extracted from FigureBuilder (mcthaydt/FigureBuilder) src/render/figure/hair.ts at a1f7246 (`HAIR_SEAM`,
// `CROWN`, `Skull`, `skull`, `onSkull`, `toHead`, `along`, `alignY`, `onHead`, `unitAt`), with AF's strict
// types; the formulas and their order are the source's. Not taken: `toSkull` (nothing builds with it).

import {
  add,
  axisAngle,
  clamp,
  cross,
  lerp,
  normalize,
  type Q,
  scale,
  smooth,
  type V3,
} from '../../../shared/math/math.ts'
import { sgnPow } from '../body/mesh.ts'
import { at, type Skeleton } from '../body/rig.ts'
import type { Line } from '../content/shapes.schema.ts'
import { type HeadForm, headAt, headNormal, insideHead } from '../outfit/garments/head.ts'

/** The hair's one surface; ropes whose gaps must show take seams of their own from HAIR_SEAM + 100. */
export const HAIR_SEAM = 2000
/**
 * The tag on the hair's top surface over the crown, and a cap's dome: where anything worn up on the head
 * lies.
 */
export const CROWN = 'crown'

export interface Skull {
  c: V3
  r: V3
  e: [number, number]
  taper: [number, number]
}
export function skull(s: Skeleton): Skull {
  const g = s.genes
  const hw = (g.head * g.headWidth) / 2
  const hd = (g.head * g.headDepth) / 2
  return {
    c: [0, g.head * 0.5, hd * (g.faceAhead - 0.15)],
    r: [hw * 1.04, g.head * 0.5, hd * 1.15],
    e: [0.6, 0.65],
    taper: [0.9, 1],
  }
}
/** A point on the skull at angle `a` and height `y`, `lift` of its radius off it. */
export function onSkull(k: Skull, a: number, y: number, lift = 0): V3 {
  const yy = clamp(y, -1, 1)
  const u = Math.asin(sgnPow(yy, 1 / k.e[0]))
  const v = Math.PI / 2 - a
  const cu = sgnPow(Math.cos(u), k.e[0])
  const tk = lerp(k.taper[0], k.taper[1], (yy + 1) / 2)
  const f = 1 + lift
  return [
    k.c[0] + cu * sgnPow(Math.cos(v), k.e[1]) * k.r[0] * tk * f,
    k.c[1] + yy * k.r[1] * f,
    k.c[2] + cu * sgnPow(Math.sin(v), k.e[1]) * k.r[2] * tk * f,
  ]
}
/** Where the ray from the skull's centre along `d` leaves the head's own form, `lift` of the skull's
 * half-width beyond (bisection on its inside test): a row's path, a bun's or a tail's root, how far a cap
 * presses the hair. */
export function toHead(f: HeadForm, k: Skull, d: V3, lift = 0): V3 {
  const n = normalize(d)
  let lo = 0
  let hi = 2 * f.h
  for (let i = 0; i < 24; i++) {
    const m = (lo + hi) / 2
    if (insideHead(f, add(k.c, scale(n, m)))) lo = m
    else hi = m
  }
  return add(k.c, scale(n, lo + lift * k.r[0]))
}
/** A line round the skull: knots of [angle from the front, height], mirrored, eased between. */
export function along(line: Line, a: number): number {
  const x = Math.abs(((((a + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) - Math.PI)
  const first = at(line, 0)
  if (x <= first[0]) return first[1]
  for (let i = 1; i < line.length; i++) {
    const [a1, y1] = at(line, i)
    if (x <= a1) {
      const [a0, y0] = at(line, i - 1)
      return lerp(y0, y1, smooth((x - a0) / (a1 - a0 || 1)))
    }
  }
  return at(line, line.length - 1)[1]
}
/** The turn that takes +y onto `dir`. */
export const alignY = (dir: V3): Q => {
  const d = normalize(dir)
  const axis = cross([0, 1, 0], d)
  return Math.hypot(...axis) < 1e-6
    ? axisAngle([1, 0, 0], d[1] > 0 ? 0 : Math.PI)
    : axisAngle(axis, Math.acos(clamp(d[1], -1, 1)))
}
/** A point on the head's own form at a skull angle and height, `lift` of the skull's half-width out. */
export function onHead(f: HeadForm, k: Skull, a: number, y: number, lift = 0): V3 {
  const t = (clamp(y, -1, 1) + 1) / 2
  const v = Math.PI / 2 - a
  return add(headAt(f, t, v), scale(headNormal(f, t, v), lift * k.r[0]))
}
/** Head units (angle-free: x, y, z of the skull's radii about its centre) to metres in the head's space. */
export const unitAt = (k: Skull, p: V3): V3 => [
  k.c[0] + p[0] * k.r[0],
  k.c[1] + p[1] * k.r[1],
  k.c[2] + p[2] * k.r[2],
]
