// The haze counts from what the gameplay camera looks at: the renderer tells it, each frame, how far that is from the eye.
import { describe, expect, it } from 'vitest'
import { hazeFocusHooks } from '#src/app/haze-focus.ts'
import type { CameraPose } from '#src/features/camera/angled-camera.ts'

const frame = { alpha: 1, frameMs: 16, paused: false }

/** A rig whose pose is `pose`, and a haze that records each focus it is given. */
function fixture(pose: CameraPose | undefined) {
  const focused: number[] = []
  const hooks = hazeFocusHooks({ pose: () => pose }, { focus: (metres) => focused.push(metres) })
  return { hooks, focused }
}

describe('hazeFocusHooks', () => {
  it('focuses the haze on the look point, the eye’s distance from it, each frame', () => {
    const origin = { x: 0, y: 0, z: 0 }
    const { hooks, focused } = fixture({
      eye: { x: 0, y: 9, z: -12 },
      look: { x: 0, y: 1, z: 2 },
      player: origin,
      cut: false,
    })
    hooks.draw?.(frame)
    expect(focused).toHaveLength(1)
    expect(focused[0]).toBeCloseTo(Math.hypot(8, 14), 10)
  })

  it('leaves the haze alone before the camera has a pose (no player row yet)', () => {
    const { hooks, focused } = fixture(undefined)
    hooks.draw?.(frame)
    expect(focused).toEqual([])
  })
})
