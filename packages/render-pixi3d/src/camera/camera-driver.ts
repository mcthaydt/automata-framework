// The renderer's side of the heading (M3 spec §4.2, §5 "View change" and "Camera turn"). The sim owns the player's
// view id and heading (`camera-heading`, a render component); each frame this reads them from the rows and drives the
// rig: the first view is a cut, a later view change an ease, and a view that sets `yawDeg` eases the heading to it
// (the sim set it the same tick), as does a change the game's `easeHeading` names (a recentre). Every other frame
// tracks the latest tick's heading exactly, not interpolated: §4.2 says nothing eases between the finger and the
// camera, and a turn is at most a tick old. Positions are
// interpolated as every view's are. A row whose view is still '' (the component's start) has no view yet. A game
// whose sim keeps fixed-point positions reads metres with `position`, and frames a lock-on target with `lock`: the
// driver then keeps every row's components by sid, so `lock` can find the target's.

import type { FrameInfo, PixiStageHooks } from '@mcthaydt/automata'
import type { FieldRecord, StepResult } from '@mcthaydt/automata-sim'
import { CameraHeading } from '../sim/camera-heading.component.js'
import type { CameraView } from '../sim/camera-view.schema.js'
import { headingDegrees } from '../sim/heading.js'
import { interpolatePose3d } from '../views/pose-3d.js'
import type { CameraRig } from './angled-camera.js'
import type { Vec3 } from './camera-pose.js'

/** `Pixi3dOptions.camera`: the angled camera on the player. */
export interface Pixi3dCameraOptions {
  /** The game's compiled `camera-view` content. */
  readonly views: readonly CameraView[]
  /** The view the camera starts in, before the player's row arrives. */
  readonly initial: string
  /** The component id holding the followed entity's `x`, `y`, `z` (metres), on the entity with `camera-heading`. */
  readonly follow: string
  /** Metres from the followed position (the feet) to the head, for the occluder rule's lines. Default 1.62. */
  readonly height?: number | undefined
  /**
   * The followed position in metres from the followed entity's components, for a sim that keeps another unit
   * (fixed point, say). Default: the `follow` component's `x`, `y`, `z`.
   */
  readonly position?: ((components: Components) => Vec3 | undefined) | undefined
  /**
   * Lock-on framing (§4.2): the point to frame with the player, from the player's components and any entity's by
   * sid (`rowOf`), or none to frame the player alone. Read each frame and passed to the rig's `frame`.
   */
  readonly lock?:
    | ((components: Components, rowOf: (sid: number) => Components | undefined) => Vec3 | undefined)
    | undefined
  /**
   * Whether this tick's heading change eases (`rig.heading(yaw, 'ease')`, about 250 ms) rather than tracking, from
   * the followed entity's components this tick and the last: a game's recentre, which jumps the heading in one tick.
   * Read on the first frame of each tick. Default: every change tracks.
   */
  readonly easeHeading?: ((curr: Components, prev: Components | undefined) => boolean) | undefined
}

/** The spec's figure (§4.2, D3-j): the occluder rule keeps the line to a head this high clear by default. */
export const PLAYER_HEIGHT = 1.62

type Components = Readonly<Record<string, Readonly<FieldRecord>>>

interface Tracked {
  readonly sid: number
  curr: Components
  prev: Components | undefined
}

const fieldsOf = (components: Components | undefined): { view: string; heading: number } | undefined => {
  const record = components?.[CameraHeading.id]
  if (record === undefined) return undefined
  return {
    view: typeof record.view === 'string' ? record.view : '',
    heading: typeof record.heading === 'number' ? record.heading : 0,
  }
}

/** Stage hooks that feed `rig` from the render rows of the entity with `camera-heading`. */
export function cameraDriver(rig: CameraRig, options: Pixi3dCameraOptions): PixiStageHooks {
  let tracked: Tracked | undefined
  let shownView: string | undefined
  // The tick's components the last `easeHeading` was asked about, so it is asked once a tick.
  let askedFor: Components | undefined
  // Every row's components by sid, kept only when `lock` needs them.
  const rows = new Map<number, Components>()
  const rowOf = (sid: number): Components | undefined => rows.get(sid)

  const forget = (): void => {
    tracked = undefined
    shownView = undefined
    rows.clear()
  }
  const keepRows = (delta: StepResult['render']): void => {
    for (const sid of delta.removed) rows.delete(sid)
    for (const row of delta.added) rows.set(row.sid, row.components)
    for (const row of delta.changed) rows.set(row.sid, row.components)
  }
  const followed = (curr: Components, prev: Components | undefined, alpha: number): Vec3 | undefined => {
    if (options.position === undefined) {
      const record = curr[options.follow]
      if (record === undefined) return undefined
      const pose = interpolatePose3d(record, prev?.[options.follow], alpha)
      return { x: pose.x, y: pose.y, z: pose.z }
    }
    const to = options.position(curr)
    const from = prev === undefined ? undefined : options.position(prev)
    if (to === undefined || from === undefined) return to
    return {
      x: from.x + (to.x - from.x) * alpha,
      y: from.y + (to.y - from.y) * alpha,
      z: from.z + (to.z - from.z) * alpha,
    }
  }

  return {
    apply(result: StepResult) {
      const delta = result.render
      if (delta.resync) forget()
      if (tracked !== undefined && delta.removed.includes(tracked.sid)) forget()
      if (options.lock !== undefined) keepRows(delta)
      const row = [...delta.added, ...delta.changed].find(
        (candidate) =>
          CameraHeading.id in candidate.components &&
          (tracked === undefined || candidate.sid === tracked.sid),
      )
      if (row !== undefined) {
        if (tracked === undefined) tracked = { sid: row.sid, curr: row.components, prev: undefined }
        else {
          tracked.prev = tracked.curr
          tracked.curr = row.components
        }
      } else if (tracked !== undefined) tracked.prev = tracked.curr
    },
    draw(frame: FrameInfo) {
      const curr = fieldsOf(tracked?.curr)
      if (tracked !== undefined && curr !== undefined) {
        if (curr.view === '') {
          // No view yet: nothing to activate, and the first real view will be a cut.
        } else if (curr.view !== shownView) {
          rig.activate(curr.view, shownView === undefined ? 'cut' : 'ease')
          // Views are read through the rig, so `setViews` on it is seen here too.
          const easeTo = shownView !== undefined && rig.viewOf(curr.view)?.yawDeg !== undefined
          shownView = curr.view
          rig.heading(headingDegrees(curr.heading), easeTo ? 'ease' : 'track')
        } else {
          const ease = tracked.curr !== askedFor && options.easeHeading?.(tracked.curr, tracked.prev) === true
          rig.heading(headingDegrees(curr.heading), ease ? 'ease' : 'track')
        }
        askedFor = tracked.curr
        const at = followed(tracked.curr, tracked.prev, frame.alpha)
        if (at !== undefined) rig.follow(at.x, at.y, at.z)
        if (options.lock !== undefined) rig.frame(options.lock(tracked.curr, rowOf))
      }
      rig.update(frame.frameMs / 1000)
    },
    reset: forget,
  }
}
