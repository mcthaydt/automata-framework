// The feet's paths through the walk cycle, and the direction they run (`moveDir`). `footPath` is FigureBuilder's
// (mcthaydt/FigureBuilder) src/render/figure/motion.ts at a1f7246, its formulas and their order. New for AF (decisions 4
// and 12): the stride runs along the direction of travel against the facing, `moveDir`, so the stride vector is the
// forward vector turned by it; across the body the stride shortens and the feet's lines move apart by its span, so a
// strafe steps out and closes and never crosses the legs; behind the back band the cycle plays backwards along the
// opposite line, so a half-turn is the forward walk in reverse.

import { smooth, type V3 } from '../../../shared/math/math.ts'
import type { Side, Skeleton } from '../body/rig.ts'
import type { Gait } from '../content/gait.schema.ts'

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

/** The band of cos(moveDir) over which the walk turns from the forward cycle (at its start and before) to the
 * reversed one (at its end and past it): about 114° to 127° either side. Away from the strafe line, so a lock-on
 * circle strafe at ±π/2 plays one cycle, continuous in moveDir. */
export const BACK_BAND: readonly [start: number, end: number] = [-0.4, -0.6]
/** At a pure strafe the stride is this share of the forward one (a side step is short)… */
const SIDE_STRIDE = 0.5
/** …and the feet's middle line sits this share of the hip width out, the stand's (FigureBuilder's 0.75), at
 * least the gait's own `track`. */
const SIDE_TRACK = 0.75

/**
 * One way of playing the walk for a direction of travel: whether the cycle runs backwards, the line the feet
 * run along (the forward vector turned by `moveDir`, or by `moveDir − π` backwards), how much of the stride is
 * across the body (`side`, |sin| of the line) and the stride's share there (`scale`).
 */
export interface Travel {
  readonly back: boolean
  readonly sin: number
  readonly cos: number
  readonly side: number
  readonly scale: number
}
export function wayOf(moveDir: number, back: boolean): Travel {
  const line = back ? moveDir - Math.PI : moveDir
  const sin = Math.sin(line)
  const side = Math.abs(sin)
  return { back, sin, cos: Math.cos(line), side, scale: 1 - (1 - SIDE_STRIDE) * side }
}
/** How much of the reversed cycle a direction plays: 0 forward of the back band, 1 behind it, eased between. */
export function backWeight(moveDir: number): number {
  const [start, end] = BACK_BAND
  return smooth((start - Math.cos(moveDir)) / (start - end))
}
/** The walk's phase as the cycle plays: `1 − phase` backwards (0 stays 0). */
export function travelPhase(phase: number, way: Travel): number {
  return way.back && phase !== 0 ? 1 - phase : phase
}
/**
 * How far out from the middle each foot's path runs (m): the gait's track, widened toward SIDE_TRACK as the
 * stride turns across the body, plus half the stride's sideways span. The feet then never cross: each path's
 * sideways reach is at most half that span about its middle, and the two paths' middles are a full span plus
 * the track apart, so the feet come no closer than the track, stepping out and closing (a side step), never
 * over each other.
 */
export function halfTrack(g: Gait, s: Skeleton, way: Travel): number {
  const k = s.genes.height / 1.62
  const track = g.track + (Math.max(g.track, SIDE_TRACK) - g.track) * way.side
  return s.genes.hips * track + (g.stride * k * way.scale * way.side) / 2
}

/** A foot's target for the legs' IK, in root space: its ankle, toes-down pitch, turn out, and whether planted. */
export interface FootTarget {
  readonly side: Side
  readonly at: V3
  readonly pitch: number
  readonly turn: number
  readonly planted: boolean
}

/** A walking foot at the walk's phase (as the sim's clock gives it, before any reversal), played `way`. */
export function footOn(g: Gait, s: Skeleton, side: Side, phase: number, way: Travel): FootTarget {
  const k = s.genes.height / 1.62
  const [z, y, pitch, planted] = footPath(
    travelPhase(phase, way) + (side === 'L' ? 0 : 0.5),
    g,
    g.stride * k,
    g.lift * k,
  )
  const x = sideSign(side) * halfTrack(g, s, way)
  const along = z * way.scale
  // The heel-to-toe roll runs along the foot: stepping across the body the foot stays flat (a side step
  // pushes off the foot's edge, not its toes), so only the stride's forward share of the roll is kept.
  const roll = pitch * Math.abs(way.cos)
  return {
    side,
    at: [x + along * way.sin, s.genes.ankle + y, along * way.cos],
    pitch: roll,
    turn: 0,
    planted,
  }
}

/**
 * A walking foot at the walk's phase for travel `moveDir`: on its path, the feet falling toward their line
 * (`track`), the path turned onto the line of travel. In the back band, where the pose blends the two ways,
 * this is the way that weighs more.
 */
export function walkFoot(g: Gait, s: Skeleton, side: Side, phase: number, moveDir = 0): FootTarget {
  return footOn(g, s, side, phase, wayOf(moveDir, backWeight(moveDir) >= 0.5))
}
