// The renderer's side of the heading (M3 spec §4.2, §5 "View change" and "Camera turn"). The sim owns the player's
// view id and heading (`camera-heading`, a render component); each frame this reads them from the rows and drives the
// rig: the first view is a cut, a later view change an ease, and a view that sets `yawDeg` eases the heading to it
// (the sim set it the same tick). Every other frame tracks the latest tick's heading exactly, not interpolated:
// §4.2 says nothing eases between the finger and the camera, and a turn is at most a tick old. Positions are
// interpolated as every view's are. A row whose view is still '' (the component's start) has no view yet.

import type { PixiStageHooks } from '@mcthaydt/automata-render-pixi'
import type { FrameInfo } from '@mcthaydt/automata-runtime'
import type { FieldRecord, StepResult } from '@mcthaydt/automata-sim'
import { CameraHeading } from '../sim/camera-heading.component.js'
import type { CameraView } from '../sim/camera-view.schema.js'
import { headingDegrees } from '../sim/heading.js'
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

/** Stage hooks that feed `rig` from the render rows of the entity with `camera-heading`. */
export function cameraDriver(rig: CameraRig, options: Pixi3dCameraOptions): PixiStageHooks {
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
        if (curr.view === '') {
          // No view yet: nothing to activate, and the first real view will be a cut.
        } else if (curr.view !== shownView) {
          rig.activate(curr.view, shownView === undefined ? 'cut' : 'ease')
          // Views are read through the rig, so `setViews` on it is seen here too.
          const easeTo = shownView !== undefined && rig.viewOf(curr.view)?.yawDeg !== undefined
          shownView = curr.view
          rig.heading(headingDegrees(curr.heading), easeTo ? 'ease' : 'track')
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
