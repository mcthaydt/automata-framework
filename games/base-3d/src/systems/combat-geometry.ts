// The hit test's plan geometry (DESIGN.md §7.3, §7.4), from The Last Light's reach bands (`src/fight/moves.ts`
// `Hit.reach`, read at `92e6704`) rewritten on integers. Pure: positions in, a yes or no out. Sim code.
import { mapStick, STICK_MAX } from '@mcthaydt/automata-render-pixi3d/sim'
import type { PlanPoint } from './area.ts'
import { signedTurn } from './lock-target.ts'

/** A direction in Q12 (4,096 to a metre's length): small enough that a product with a Q4 offset stays exact. */
export interface Q12Direction {
  readonly x: number
  readonly z: number
}

/** A move's reach along the attacker's facing, in Q16.16 metres from where he stands. */
export interface Reach {
  readonly near: number
  readonly far: number
}

/** Q16.16 to Q4 (a sixteenth of a metre), truncated, as lock-target.ts does, so every product below is exact. */
const toQ4 = (value: number): number => Math.trunc(value / 4096)

/** `facing` (turn units, 0 toward +z, growing toward +x) as a Q12 direction: the stick's "up" mapped through it. */
export function facingVector(facing: number): Q12Direction {
  const { x, z } = mapStick({ x: 0, y: -STICK_MAX }, facing)
  return { x: Math.round(x / 16) + 0, z: Math.round(z / 16) + 0 }
}

/**
 * Whether a reach from `reach.near` to `reach.far` along `forward` from `from` meets a cylinder of `radius` at `at`,
 * in plan. The offset is turned into the attacker's frame (along and beside, in Q4), the along part clamped to the
 * band, and the rest compared with the radius squared: one integer path, so every engine agrees.
 */
export function reachHits(
  from: PlanPoint,
  forward: Q12Direction,
  reach: Reach,
  at: PlanPoint,
  radius: number,
): boolean {
  const dx = toQ4(at.x - from.x)
  const dz = toQ4(at.z - from.z)
  // Q4 × Q12 / 4,096 = Q4; both products stay under 2^53 for any offset a room holds.
  const along = Math.trunc((dx * forward.x + dz * forward.z) / 4096)
  const beside = Math.trunc((dx * forward.z - dz * forward.x) / 4096)
  const near = toQ4(reach.near)
  const far = toQ4(reach.far)
  const clamped = Math.min(Math.max(along, near), far)
  const r = toQ4(radius)
  const off = along - clamped
  return off * off + beside * beside <= r * r
}

/** Whether a ring of `far` round `from` meets a cylinder of `radius` at `at`, in plan (an `around` hit, a spin). */
export function ringHits(from: PlanPoint, far: number, at: PlanPoint, radius: number): boolean {
  const dx = toQ4(at.x - from.x)
  const dz = toQ4(at.z - from.z)
  const reach = toQ4(far) + toQ4(radius)
  return dx * dx + dz * dz <= reach * reach
}

/** Whether `bearing` lies within `half` turn units either side of `facing` (both in turn units). */
export function inArc(facing: number, bearing: number, half: number): boolean {
  return Math.abs(signedTurn(bearing - facing)) <= half
}
