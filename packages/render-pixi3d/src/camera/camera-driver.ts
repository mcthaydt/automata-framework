// The renderer's side of the heading (M3 spec §4.2, §5 "View change" and "Camera turn"). The sim owns the player's
// view id and heading (`camera-heading`, a render component); each frame this reads them from the rows and drives the
// rig: the first view is a cut, a later view change an ease, and a view that sets `yawDeg` eases the heading to it
// (the sim set it the same tick). Every other frame tracks the heading, interpolated between ticks by the shorter
// arc like positions; on the tick a view changes it uses the new heading as is, so the track matches the ease's
// target and lets it finish.

import type { PixiStageHooks } from '@mcthaydt/automata-render-pixi'
import type { FrameInfo } from '@mcthaydt/automata-runtime'
import type { FieldRecord, StepResult } from '@mcthaydt/automata-sim'
import { CameraHeading } from '../sim/camera-heading.component.js'
import type { CameraView } from '../sim/camera-view.schema.js'
import { headingDegrees, TURN_UNITS } from '../sim/heading.js'
import { interpolatePose3d } from '../views/pose-3d.js'
import type { CameraRig } from './angled-camera.js'

/** `Pixi3dOptions.camera`: the angled camera on the player. */
export interface Pixi3dCameraOptions {
  /** The game's compiled `camera-view` content. */
  readonly views: readonly CameraView[]
  /** The view the camera starts in, before the player's row arrives. */
  readonly initial: string
  /** The component id holding the followed entity's `x`, `y`, `z` (metres), on the entity with `camera-heading`. */
  readonly follow: string
}

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

/** The heading `alpha` of the way from `from` to `to` (turn units) the shorter way, in degrees inside one turn. */
function interpolatedHeading(from: number, to: number, alpha: number): number {
  const half = TURN_UNITS / 2
  const turn = ((((to - from) % TURN_UNITS) + TURN_UNITS + half) % TURN_UNITS) - half
  const units = from + turn * alpha
  return (((units % TURN_UNITS) + TURN_UNITS) % TURN_UNITS) * (360 / TURN_UNITS)
}

/** Stage hooks that feed `rig` from the render rows of the entity with `camera-heading`. */
export function cameraDriver(rig: CameraRig, options: Pixi3dCameraOptions): PixiStageHooks {
  const views = new Map(options.views.map((view) => [view.id, view]))
  let tracked: Tracked | undefined
  let shownView: string | undefined

  const forget = (): void => {
    tracked = undefined
    shownView = undefined
  }

  return {
    apply(result: StepResult) {
      const delta = result.render
      if (delta.resync) forget()
      if (tracked !== undefined && delta.removed.includes(tracked.sid)) forget()
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
        const prev = fieldsOf(tracked.prev)
        const entered = curr.view !== shownView
        if (entered) {
          rig.activate(curr.view, shownView === undefined ? 'cut' : 'ease')
          const easeTo = shownView !== undefined && views.get(curr.view)?.yawDeg !== undefined
          shownView = curr.view
          rig.heading(headingDegrees(curr.heading), easeTo ? 'ease' : 'track')
        } else if (prev !== undefined && prev.view === curr.view) {
          rig.heading(interpolatedHeading(prev.heading, curr.heading, frame.alpha))
        } else rig.heading(headingDegrees(curr.heading))
        const record = tracked.curr[options.follow]
        if (record !== undefined) {
          const pose = interpolatePose3d(record, tracked.prev?.[options.follow], frame.alpha)
          rig.follow(pose.x, pose.y, pose.z)
        }
      }
      rig.update(frame.frameMs / 1000)
    },
    reset: forget,
  }
}
