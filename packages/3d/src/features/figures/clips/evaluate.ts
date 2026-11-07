// evaluate: one figure's pose at a presentation time, from what the sim says (`FigureState`) and
// the content it plays from. Pure: the same skeleton, definition, state, time, library and options give equal
// matrices (I-g). The order:
//
//   1. Locomotion: `base()` with the stand's placed hands (`evaluateMotion` without the item), stepped
//      at the gait's pose clock.
//   2. Stance clips, in the sim's order, each masked and at its blend ramp's weight.
//   3. The action clip; one replacing another carries the outgoing pose into it (M3R-D16).
//   4. Aim and 5. the solve: every merged handle, the aim and the pins, in one `solve()`.
//   6. The item's hold, on its arm only while no clip owns that arm.
//   7. Secondary: the hems hang again from legs a clip or a pin moved; the hair swings in step 1.
//
// The plan's decisions 1 to 12 (docs/archive/superpowers/plans/2026-10-30-m3-6d-evaluate.md) say what each step reads.

import { clonePose, fk, type Skeleton } from '../body/rig.ts'
import type { Gait } from '../content/gait.schema.ts'
import { DEFAULT_RIG_LIMITS } from '../content/rig-limits.schema.ts'
import type { FigureDef } from '../figure/figure.schema.ts'
import { applyPose } from '../motion/apply-pose.ts'
import { blend } from '../motion/blend.ts'
import { poseClock } from '../motion/clock.ts'
import { gaitOf } from '../motion/gait-of.ts'
import { backWeight, wayOf } from '../motion/gait-path.ts'
import { placeHems } from '../motion/hems.ts'
import { applyHold, evaluateMotion, holdOf } from '../motion/hold.ts'
import type { Evaluated } from '../motion/motion-state.ts'
import type { PoseDef } from '../motion/pose.schema.ts'
import type { SpaceContext } from '../motion/pose-space.ts'
import { solve } from '../motion/solve.ts'
import type { SolveReport } from '../motion/targets.ts'
import { chestFrame } from './blend-key-poses.ts'
import type { FigureClipDef, MaskGroup } from './clip.schema.ts'
import { retime } from './clip-time.ts'
import type { ClipStart, EvaluateOptions, FigureState, MotionLibrary } from './figure-state.ts'
import { addTurns, type ClipLayerOptions, clipLayer, clipPose, type Layer, mergeLayer } from './layers.ts'
import { movesLegs, ownsArm } from './masks.ts'

/** A new action carries the outgoing one into it over this long when its clip gives no `blend.inMs`. */
const TRANSITION_MS = 80

export interface FigureEvaluated extends Evaluated {
  /** The solve's report: what was reached, and which joints a limit clamped. */
  readonly report: SolveReport
}

interface Playing {
  readonly clip: FigureClipDef
  readonly options: ClipLayerOptions
  readonly elapsed: number
}

/** Everything one evaluation shares: the figure's content and how to sample its clips. */
interface Context {
  readonly library: MotionLibrary
  readonly gait: Gait
  readonly time: number
  readonly options: EvaluateOptions
  readonly space: SpaceContext
}

/** A clip the sim started, as it plays at the context's time: retimed, with its sampling options; undefined (and
 * warned once) when the library lacks it. */
function playing(start: ClipStart, ctx: Context, endedAt?: number): Playing | undefined {
  const authored = ctx.library.clips[start.id]
  if (!authored) {
    const { warn, warned } = ctx.options
    if (warn && !warned?.has(start.id)) {
      warned?.add(start.id)
      warn(`figure: no figure-clip has the id ${start.id}; the figure keeps its locomotion`)
    }
    return undefined
  }
  const clip = start.length === undefined ? authored : retime(authored, start.length)
  const previous = ctx.options.previous
  return {
    clip,
    elapsed: ctx.time - start.startedAt,
    options: {
      poses: ctx.library.poses,
      rate: clip.rate ?? ctx.gait.poseRate,
      smooth: ctx.options.smooth,
      previous:
        previous !== undefined && previous >= start.startedAt ? previous - start.startedAt : undefined,
      end: endedAt !== undefined ? endedAt - start.startedAt : clip.loop === 'once' ? clip.length : undefined,
      context: ctx.space,
    },
  }
}

/** The action's layer: its own, or, while it replaces another, the outgoing clip's pose at the
 * replacement blended into its own with `blend` over its `blend.inMs` (80 ms when it gives none; 0 cuts). */
function actionLayer(state: FigureState, ctx: Context): Layer | undefined {
  const { action } = state
  if (!action) return undefined
  const incoming = playing(action, ctx)
  if (!incoming) return undefined
  const own = clipLayer(incoming.clip, incoming.elapsed, incoming.options)
  const replaced = action.replaced && incoming.clip.mode !== 'additive' ? action.replaced : undefined
  const inMs = incoming.clip.blend?.inMs ?? TRANSITION_MS
  const u = inMs > 0 ? (incoming.elapsed * 1000) / inMs : 1
  if (!replaced || u >= 1 || incoming.elapsed < 0) return own
  const outgoing = playing(replaced, {
    ...ctx,
    time: action.startedAt,
    options: { ...ctx.options, previous: undefined },
  })
  const outLayer = outgoing && clipLayer(outgoing.clip, outgoing.elapsed, outgoing.options)
  // The outgoing pose as it showed, its own ramp included (a clip cut into while it ramped in shows partly).
  const outPose: PoseDef = outLayer ? mergeLayer({ effectors: {} }, outLayer, ctx.space) : { effectors: {} }
  const inPose = clipPose(incoming.clip, incoming.elapsed, incoming.options)
  const mask: MaskGroup[] = [...new Set([...(outgoing?.clip.mask ?? []), ...incoming.clip.mask])]
  return {
    // The outgoing pose is frozen at the replacement: one pose blend per transition, not a crossfade.
    pose: blend(outPose, inPose, Math.max(0, u), ctx.space),
    weight: 1,
    mask,
    additive: false,
  }
}

/** The stance layers, in the sim's order. */
function stanceLayers(state: FigureState, ctx: Context): Layer[] {
  const layers: Layer[] = []
  for (const stance of state.stances ?? []) {
    const play = playing(stance, ctx, stance.endedAt)
    const layer = play && clipLayer(play.clip, play.elapsed, play.options)
    if (layer) layers.push(layer)
  }
  return layers
}

/**
 * The figure's pose and world matrices at presentation time `time` (seconds): the root at the origin facing
 * `state.facing`, in the skeleton's metres. See the file's note for the order.
 */
export function evaluate(
  skeleton: Skeleton,
  def: FigureDef,
  state: FigureState,
  time: number,
  library: MotionLibrary,
  options: EvaluateOptions = {},
): FigureEvaluated {
  const gait = gaitOf(def, library.gaits)
  const limits = (def.rig !== undefined ? library.rigs[def.rig] : undefined) ?? DEFAULT_RIG_LIMITS
  const clock = poseClock(gait, time)
  const loco = evaluateMotion(skeleton, gait, {
    t: clock.t,
    moving: state.moving,
    phase: clock.phase,
    yaw: state.facing,
    headYaw: 0,
    shuffle: 0,
    moveDir: state.moveDir,
    hair: state.hair,
    stand: def.stand !== undefined ? library.stands[def.stand] : undefined,
  })
  const ctx: Context = { library, gait, time, options, space: { chest: chestFrame(skeleton, loco.world) } }
  const action = actionLayer(state, ctx)
  const layers = [...stanceLayers(state, ctx), ...(action ? [action] : [])]

  let merged: PoseDef = { effectors: {} }
  for (const layer of layers)
    merged = layer.additive ? addTurns(merged, layer) : mergeLayer(merged, layer, ctx.space)
  const { base, targets } = applyPose(skeleton, loco.pose, merged)
  const solved = solve(skeleton, base, { ...targets, aim: state.aim ?? [], pins: state.pins ?? {} }, limits)
  let out: Evaluated = { pose: solved.pose, world: solved.world }

  const item = state.item !== undefined ? library.items[state.item] : undefined
  if (item && !layers.some((layer) => ownsArm(layer.mask, def.hand)))
    out = applyHold(skeleton, out, holdOf(item, skeleton, def.hand))

  const pins = state.pins ?? {}
  if (movesLegs(merged) || pins.footL || pins.footR) {
    const pose = clonePose(out.pose)
    const moveDir = state.moveDir ?? 0
    const way = wayOf(moveDir, backWeight(moveDir) >= 0.5)
    placeHems(skeleton, pose, out.world, state.moving ? [way.sin, way.cos] : undefined)
    out = { pose, world: fk(skeleton, pose) }
  }
  return { ...out, report: solved.report }
}
