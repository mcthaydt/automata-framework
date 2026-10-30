// The feet's paths through the walk cycle, and the direction they run (`moveDir`).
//
// `footPath` is FigureBuilder's (mcthaydt/FigureBuilder) src/render/figure/motion.ts at a1f7246, its formulas
// and their order. New for AF (M3 spec §4.4.1, F-h): the stride runs along the direction of travel against the
// facing, `moveDir`, so the stride vector is the forward vector turned by it; travel with a backward part plays
// the cycle backwards along the opposite direction, so a half-turn is the forward walk in reverse.

import type { Gait } from '../library/gait.schema'
import { smooth, type V3 } from '../math/math'
import type { Side, Skeleton } from '../rig/rig'

export const TAU: number = Math.PI * 2
const frac = (v: number): number => v - Math.floor(v)
export const sideSign = (s: Side): number => (s === 'L' ? 1 : -1)
/** The heel-to-toe roll: toes up as the heel strikes (rad), and the heel up as the toes push off (the gait's own, else these). */
const HEEL_ = 0.22
const PUSH_ = 0.35
/** The most the toes point down (rad), pushing off or in the swing: a foot pitched further reads as a kneel. */
const TOE_DOWN = 0.26

/**
 * One foot's ankle offset at foot phase f: z forward and y up (its lift off the floor), its pitch (toes down
 * positive), and whether it is planted. The foot rolls as a walker's does: it lands on its heel with the toes
 * up, flattens, peels off from the heel to push on the toes, and swings through, level a third of the way, to
 * land on the heel again. The path sits back by half the reach the stance's overlap gives the leading foot
 * over the trailing one, so at the strike both legs run long, and the swing takes the foot forward from the
 * off so its shin leaves the floor rather than trailing on it.
 */
export function footPath(
  f: number,
  g: Gait,
  stride: number,
  lift: number,
): [z: number, y: number, pitch: number, planted: boolean] {
  const k = frac(f)
  const roll = 1 - g.drag
  const HEEL = g.heel ?? HEEL_
  const PUSH = Math.min(g.push ?? PUSH_, TOE_DOWN)
  const back = (stride * (1 - 0.5 / g.duty)) / 4
  if (k < g.duty) {
    const u = k / g.duty
    const pitch =
      roll * (u < 0.18 ? -HEEL * (1 - smooth(u / 0.18)) : u > 0.7 ? PUSH * smooth((u - 0.7) / 0.3) : 0)
    return [stride / 2 - stride * u - back, 0, pitch, true]
  }
  // The swing: forward with an eased arc, from the push-off's toes down, level a third of the way, to the strike's toes up.
  const s = (k - g.duty) / (1 - g.duty)
  const pitch =
    roll * (PUSH * (1 - smooth(Math.min(1, s / 0.3))) - HEEL * smooth(Math.max(0, (s - 0.5) / 0.5))) +
    g.drag * 0.35 * Math.sin(Math.PI * s)
  return [
    -stride / 2 - back + (stride * (smooth(s) + s)) / 2,
    lift * Math.sin(Math.PI * s) * (1 - 0.7 * g.drag),
    Math.min(pitch, TOE_DOWN),
    false,
  ]
}

/** The way a walk runs for `moveDir`: whether the cycle plays backwards, and the line the feet run along. */
export interface Travel {
  readonly back: boolean
  readonly sin: number
  readonly cos: number
}
export function travel(moveDir: number): Travel {
  // Backing away (any travel with a backward part) plays the cycle in reverse along the opposite line.
  const back = Math.cos(moveDir) < 0
  const line = back ? moveDir - Math.PI : moveDir
  return { back, sin: Math.sin(line), cos: Math.cos(line) }
}
/** The walk's phase as the cycle plays: `1 − phase` backing away (0 stays 0). */
export function travelPhase(phase: number, way: Travel): number {
  return way.back && phase !== 0 ? 1 - phase : phase
}

/** A foot's target for the legs' IK, in root space: its ankle, toes-down pitch, turn out, and whether planted. */
export interface FootTarget {
  readonly side: Side
  readonly at: V3
  pitch: number
  readonly turn: number
  readonly planted: boolean
}

/**
 * A walking foot at the walk's phase (as the sim's clock gives it, before any reversal): on its path, the
 * feet falling toward one line under the body (`track`), the path turned onto the line of travel.
 */
export function walkFoot(g: Gait, s: Skeleton, side: Side, phase: number, moveDir = 0): FootTarget {
  const k = s.genes.height / 1.62
  const way = travel(moveDir)
  const [z, y, pitch, planted] = footPath(
    travelPhase(phase, way) + (side === 'L' ? 0 : 0.5),
    g,
    g.stride * k,
    g.lift * k,
  )
  const x = sideSign(side) * s.genes.hips * g.track
  return { side, at: [x + z * way.sin, s.genes.ankle + y, z * way.cos], pitch, turn: 0, planted }
}
