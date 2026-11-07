// The light a figure stands in, as a pixel artist lights a sprite: lamps whose pools lift a texel whole steps up its
// own ramp, falling off in rings. This file is the lamps' maths (what a lamp's strength is at a moment and how many
// steps it lifts a point); the look's sprite light applies it. Space is the figure's: metres from its feet, x to the
// screen's right, y up, z toward the camera.

/** A point in the figure's space. */
export type Point = readonly [number, number, number]

/**
 * A lamp: where it is, its colour (`#rrggbb`) and how many tone steps it lifts a texel at its heart, how far it
 * reaches (m); a spot's aim and cone (degrees); a flicker (how much of its strength it can lose, how often, its
 * seed); how far its colour tints what it lights (0 to 1); a level (0 off, 1 as authored) and a light style (a
 * letter a to z per 1/`styleRate` s: `a` dark, `m` as authored, `z` double).
 */
export interface FigureLamp {
  readonly at: Point
  readonly color: string
  readonly steps: number
  readonly radius: number
  readonly aim?: Point
  readonly cone?: number
  readonly flicker?: number
  readonly rate?: number
  readonly seed?: number
  readonly tint?: number
  readonly level?: number
  readonly style?: string
  readonly styleRate?: number
}

/** View space (x right, y up, z toward the camera) to the world, for a camera pitched down by `pitch`. */
export function viewToWorld(v: Point, pitch: number): [number, number, number] {
  const c = Math.cos(pitch)
  const s = Math.sin(pitch)
  return [v[0], v[1] * c + v[2] * s, -v[1] * s + v[2] * c]
}

/** One lattice point's value in [0, 1): an integer hash. */
function lattice(x: number, y: number, z: number): number {
  let n = Math.imul(x, 0x27d4eb2d) ^ Math.imul(y, 0x165667b1) ^ Math.imul(z, 0x9e3779b1)
  n = Math.imul(n ^ (n >>> 15), 0x85ebca6b)
  n ^= n >>> 13
  return (n >>> 0) / 4294967296
}

/** Smooth 3D value noise in [0, 1), deterministic: the hash at the lattice's corners, smoothstep-blended. */
export function noise3(x: number, y: number, z: number): number {
  const x0 = Math.floor(x)
  const y0 = Math.floor(y)
  const z0 = Math.floor(z)
  const fx = x - x0
  const fy = y - y0
  const fz = z - z0
  const u = fx * fx * (3 - 2 * fx)
  const v = fy * fy * (3 - 2 * fy)
  const w = fz * fz * (3 - 2 * fz)
  const at = (i: number, j: number, k: number): number => lattice(x0 + i, y0 + j, z0 + k)
  const x00 = at(0, 0, 0) + (at(1, 0, 0) - at(0, 0, 0)) * u
  const x10 = at(0, 1, 0) + (at(1, 1, 0) - at(0, 1, 0)) * u
  const x01 = at(0, 0, 1) + (at(1, 0, 1) - at(0, 0, 1)) * u
  const x11 = at(0, 1, 1) + (at(1, 1, 1) - at(0, 1, 1)) * u
  const y0v = x00 + (x10 - x00) * v
  const y1v = x01 + (x11 - x01) * v
  return y0v + (y1v - y0v) * w
}

/** A light style's value at `t`: its letters a to z (a 0, m 1, z 2), one per 1/rate s, looping. */
function styleAt(style: string, t: number, rate: number): number {
  if (!style.length) return 1
  const letter = style.charCodeAt(Math.floor(Math.max(0, t) * rate + 1e-6) % style.length) - 97
  return Math.max(0, Math.min(25, letter)) / 12
}

/** A flicker drops in steps (a quarter at a time), now and then to nearly nothing, held for a sprite frame (1/12 s). */
function flickerAt(lamp: FigureLamp, t: number): number {
  if (!lamp.flicker) return 1
  const held = Math.floor(t * 12) / 12
  const rate = lamp.rate ?? 6
  const seed = lamp.seed ?? 0
  const v = noise3(held * rate, seed * 7.7, 0.5)
  const dip = noise3(held * rate * 0.37 + 9, seed, 3.1) > 0.72 ? 0.85 : 0
  return Math.max(
    0,
    1 - Math.round(((lamp.flicker * Math.max(0, v - 0.35)) / 0.65 + dip * lamp.flicker) * 4) / 4,
  )
}

/** A lamp's strength at `t` (s): 1, or its flicker; times its light style and level, in quarters, when it has them. */
export function strength(lamp: FigureLamp, t: number): number {
  const base = flickerAt(lamp, t)
  if (lamp.level === undefined && lamp.style === undefined) return base
  const style = lamp.style ? styleAt(lamp.style, t, lamp.styleRate ?? 10) : 1
  return Math.max(0, Math.round(base * style * (lamp.level ?? 1) * 4) / 4)
}

const unit = (v: Point): Point => {
  const length = Math.hypot(v[0], v[1], v[2]) || 1
  return [v[0] / length, v[1] / length, v[2] / length]
}

/**
 * How many ramp steps a lamp at strength `s` lifts a surface at (px, py, pz) facing (nx, ny, nz): its steps at its
 * heart, falling off as (1 - (d/r)²)² (smooth to its edge, so its rings come out evenly spaced), on a wrapped N·L
 * (a floor under a lamp still catches it), inside its cone if it is a spot.
 */
export function lampSteps(
  lamp: FigureLamp,
  s: number,
  px: number,
  py: number,
  pz: number,
  nx: number,
  ny: number,
  nz: number,
): number {
  const dx = lamp.at[0] - px
  const dy = lamp.at[1] - py
  const dz = lamp.at[2] - pz
  const d2 = dx * dx + dy * dy + dz * dz
  const r2 = lamp.radius * lamp.radius
  if (d2 >= r2 || s <= 0) return 0
  const d = Math.sqrt(d2) || 1e-6
  const falloff = 1 - d2 / r2
  const wrap = 0.35
  const lambert = Math.max(0, ((nx * dx + ny * dy + nz * dz) / d + wrap) / (1 + wrap))
  let cone = 1
  if (lamp.aim && lamp.cone) {
    const a = unit(lamp.aim)
    const cosine = -(a[0] * dx + a[1] * dy + a[2] * dz) / d
    const edge = Math.cos((lamp.cone * Math.PI) / 180)
    cone = Math.max(0, Math.min(1, ((cosine - edge) / (1 - edge)) * 3))
  }
  return lamp.steps * s * falloff * falloff * lambert * cone
}
