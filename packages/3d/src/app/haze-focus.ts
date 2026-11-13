// The haze counts from the focus: what the camera looks at (`HazeEffect`). With the angled camera that is the player,
// as far from the eye as the view's distance (16 m by default, less while the framing pushes in), so the renderer tells
// the haze each frame. Left at the profile's first-person focus (3 m from the eye), everything the gameplay camera
// framed lay past the haze's far edge and drew as a flat veil (docs/superpowers/audits/2026-11-12-3d-night-regression).
//
// Presentation only (law 1): it reads the camera's pose and writes one uniform.

import type { PixiStageHooks } from '@automata/framework'
import type { CameraRig } from '../features/camera/angled-camera.ts'
import type { HazeEffect } from '../features/look/haze.ts'

/** Hooks that focus `haze` on the rig's look point after the camera has moved each frame. */
export function hazeFocusHooks(
  rig: Pick<CameraRig, 'pose'>,
  haze: Pick<HazeEffect, 'focus'>,
): PixiStageHooks {
  return {
    draw() {
      // No pose until the camera has followed someone: the profile's focus holds until then.
      const pose = rig.pose()
      if (pose === undefined) return
      const { eye, look } = pose
      haze.focus(Math.hypot(eye.x - look.x, eye.y - look.y, eye.z - look.z))
    },
  }
}
