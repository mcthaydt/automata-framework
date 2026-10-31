// The lock's selection math (DESIGN.md §11.1): which targets Wick can lock, which one a press picks, and which one a
// cycle moves to. Pure functions over Q16.16 plan points, so the systems and the tests share them. Sim code.
import { mapStick, STICK_MAX, TURN_UNITS, wrapHeading } from '@mcthaydt/automata-render-pixi3d/sim'
import { atan2 } from '@mcthaydt/automata-sim/math'
import { LOCK_FALLBACK, LOCK_RANGE } from '../constants.ts'
import type { PlanBox, PlanPoint } from './area.ts'

/** A target the lock can pick: its entity id and where it stands. */
export interface LockPoint extends PlanPoint {
  readonly id: number
}

// 2π spelled out: `Math.PI` is not sim-safe.
const TAU = 6.283185307179586
const HALF_TURN = TURN_UNITS / 2

/** The turn-unit angle of the plan direction `x`, `z` (0 toward +z, growing toward +x), rounded to a unit. */
export const angleOf = (x: number, z: number): number => wrapHeading((atan2(x, z) * TURN_UNITS) / TAU)

/** `units` as the nearest signed angle, −32,768..32,767. */
export const signedTurn = (units: number): number => wrapHeading(units + HALF_TURN) - HALF_TURN

const distanceSquared = (a: PlanPoint, b: PlanPoint): number =>
  (a.x - b.x) * (a.x - b.x) + (a.z - b.z) * (a.z - b.z)

/** `num / den` with `den > 0`; `den` 0 stands for no bound on that side. */
interface Fraction {
  readonly num: number
  readonly den: number
}

// Fractions compare by cross-multiplying: numerators are plan offsets times a delta (under 2^23 × 2^23 in any area
// smaller than 128 m), so the products are exact.
const below = (a: Fraction, b: Fraction): boolean => a.num * b.den < b.num * a.den

/**
 * The open range of `t` in which `start + t × delta` lies strictly between `min` and `max`, or undefined when it
 * never does. A zero delta inside the range constrains nothing (0/1 to 1/1 covers the segment).
 */
function inside(start: number, delta: number, min: number, max: number): [Fraction, Fraction] | undefined {
  if (delta === 0)
    return min < start && start < max
      ? [
          { num: 0, den: 1 },
          { num: 1, den: 1 },
        ]
      : undefined
  const den = Math.abs(delta)
  const sign = delta > 0 ? 1 : -1
  const a = { num: (min - start) * sign, den }
  const b = { num: (max - start) * sign, den }
  return delta > 0 ? [a, b] : [b, a]
}

/** Whether the segment from `from` to `to` passes through a wall's inside: grazing a face or a corner does not. */
function crosses(wall: PlanBox, from: PlanPoint, to: PlanPoint): boolean {
  const x = inside(from.x, to.x - from.x, wall.minX, wall.maxX)
  const z = inside(from.z, to.z - from.z, wall.minZ, wall.maxZ)
  if (x === undefined || z === undefined) return false
  let enter: Fraction = { num: 0, den: 1 }
  let exit: Fraction = { num: 1, den: 1 }
  for (const [low, high] of [x, z]) {
    if (below(enter, low)) enter = low
    if (below(high, exit)) exit = high
  }
  return below(enter, exit)
}

/** Whether nothing in `walls` stands between `from` and `to` in plan (DESIGN.md §11.1's clear line). */
export const lineOfSight = (walls: readonly PlanBox[], from: PlanPoint, to: PlanPoint): boolean =>
  !walls.some((wall) => crosses(wall, from, to))

/** The targets within 12 m of Wick with a clear line to him, in id order. */
export function lockCandidates(
  walls: readonly PlanBox[],
  hero: PlanPoint,
  targets: readonly LockPoint[],
): LockPoint[] {
  return targets
    .filter((target) => distanceSquared(target, hero) <= LOCK_RANGE * LOCK_RANGE)
    .filter((target) => lineOfSight(walls, hero, target))
    .sort((a, b) => a.id - b.id)
}

// The cone works on coarse integers so every product of four stays exact: offsets in 1/16 m (192 at 12 m) and the
// camera's forward in 1/256 (a unit vector of length 256).
const toSixteenths = (q16: number): number => Math.trunc(q16 / 4_096)
const toUnit256 = (q16: number): number => Math.trunc(q16 / 256)

interface Coned extends LockPoint {
  readonly dot: number
  readonly lengthSquared: number
  readonly distance: number
}

/** Whether `a` lies nearer the heading than `b`: a larger cosine, `dot / |d|`, compared squared (both dots > 0). */
const nearerAxis = (a: Coned, b: Coned): boolean =>
  a.dot * a.dot * b.lengthSquared > b.dot * b.dot * a.lengthSquared

const lowerScore = (a: { score: number; id: number }, b: { score: number; id: number }): boolean =>
  a.score < b.score || (a.score === b.score && a.id < b.id)

/**
 * The target a lock press picks (G3-e): inside the ±60° cone around the camera's forward, the smallest
 * `angleRank × 4 + distanceRank` (a rank counts the candidates strictly better), a tie to the lower id; with the
 * cone empty, the nearest within 6 m in any direction; else 0, none.
 */
export function selectLock(candidates: readonly LockPoint[], hero: PlanPoint, heading: number): number {
  const forward = mapStick({ x: 0, y: -STICK_MAX }, heading)
  const fx = toUnit256(forward.x)
  const fz = toUnit256(forward.z)
  const forwardSquared = fx * fx + fz * fz
  const coned: Coned[] = []
  for (const point of candidates) {
    const dx = toSixteenths(point.x - hero.x)
    const dz = toSixteenths(point.z - hero.z)
    const dot = dx * fx + dz * fz
    const lengthSquared = dx * dx + dz * dz
    // cos² 60° is 1/4: inside when dot² ≥ |d|²|f|² / 4, with the dot positive (in front).
    if (dot > 0 && 4 * dot * dot >= lengthSquared * forwardSquared)
      coned.push({ ...point, dot, lengthSquared, distance: distanceSquared(point, hero) })
  }
  let best = { score: Number.POSITIVE_INFINITY, id: 0 }
  for (const point of coned) {
    let angleRank = 0
    let distanceRank = 0
    for (const other of coned) {
      if (nearerAxis(other, point)) angleRank += 1
      if (other.distance < point.distance) distanceRank += 1
    }
    const scored = { score: angleRank * 4 + distanceRank, id: point.id }
    if (lowerScore(scored, best)) best = scored
  }
  if (best.id !== 0) return best.id
  for (const point of candidates) {
    const distance = distanceSquared(point, hero)
    if (distance > LOCK_FALLBACK * LOCK_FALLBACK) continue
    const scored = { score: distance, id: point.id }
    if (lowerScore(scored, best)) best = scored
  }
  return best.id
}

/**
 * The target a `lock-cycle` moves to from `current` (G3-h): the candidate the smallest turn away around Wick in
 * `dir`'s direction (1 clockwise seen from above, which is decreasing turn units; −1 anticlockwise), a tie to the
 * lower id. `current` itself counts as a whole turn away, so a lone candidate keeps itself and the order wraps.
 */
export function cycleLock(
  candidates: readonly LockPoint[],
  hero: PlanPoint,
  current: LockPoint,
  dir: 1 | -1,
): number {
  const from = angleOf(current.x - hero.x, current.z - hero.z)
  let best = { score: Number.POSITIVE_INFINITY, id: 0 }
  for (const point of candidates) {
    const angle = angleOf(point.x - hero.x, point.z - hero.z)
    const away = point.id === current.id ? 0 : wrapHeading(dir === 1 ? from - angle : angle - from)
    const scored = { score: away === 0 ? TURN_UNITS : away, id: point.id }
    if (lowerScore(scored, best)) best = scored
  }
  return best.id
}
