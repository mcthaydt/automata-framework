// "A texel is never minified": the example's own numbers (its size, its camera's distance, the default 30° tilt and the
// 50 mm lens), through the builder's own `zoomOf`, never typed. The size and the distance are read from the example, so a
// change there moves this test with it. Under reduced motion klipp's damping is zero, so the camera sits on its target:
// `distance` back from a focus 1 m above the walker's feet, `tiltDeg` down.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { CAMERA_DEFAULTS, fovOf, LENS_MM } from '@automata/3d/camera-view'
import { describe, expect, it } from 'vitest'
import { place } from '#src/features/painted/place.ts'
import { poseOf } from '#src/features/painted/pose.ts'
import { BASE, type CharacterDef, type V3, zoomOf } from '#src/shared/figure-builder/door.ts'
import { followCamera } from '../../fixtures/cameras.ts'
import { painted } from '../../fixtures/painted-cell.ts'

const MAN = BASE[0]?.def as CharacterDef
const EXAMPLE = join(import.meta.dirname, '../../../../../examples/3d/characterkit/characterkit-painted.ts')
/** The example's field size. */
const SIZE = (() => {
  const match = /size:\s*\{\s*width:\s*(\d+),\s*height:\s*(\d+)\s*\}/.exec(readFileSync(EXAMPLE, 'utf8'))
  if (!match) throw new Error('characterkit-painted.ts has no `size: { width, height }`')
  return [Number(match[1]), Number(match[2])] as const
})()
/** How far back the example's follow camera is. */
const DISTANCE = (() => {
  const match = /cameraView\('follow',\s*\{[^}]*distance:\s*([\d.]+)/.exec(readFileSync(EXAMPLE, 'utf8'))
  if (!match) throw new Error("characterkit-painted.ts has no `cameraView('follow', { distance })`")
  return Number(match[1])
})()
/** The corners of the walker's 2 m square. */
const CORNERS: readonly (readonly [number, number])[] = [
  [-1, -1],
  [1, -1],
  [1, 1],
  [-1, 1],
]
const { tiltDeg, focusHeight } = CAMERA_DEFAULTS
const camera = (focus: readonly [number, number, number], size: readonly [number, number]) =>
  poseOf(followCamera(focus, DISTANCE, tiltDeg, focusHeight, fovOf(LENS_MM)), size)

/** The texels a pixel at the walker's feet (what `scale` rounds) with the camera on the walker. */
const walkerZoom = (size: readonly [number, number]) => zoomOf(camera([0, 0, 0], size), [0, 0, 0]) / 2

describe('a texel is never minified in characterkit-painted', () => {
  it('draws the walker at one pixel a texel at every corner of its square, about true scale', () => {
    for (const [x, z] of CORNERS) {
      const pose = camera([x, 0, z], SIZE)
      const at: V3 = [x, 0, z]
      expect(place(pose, at, painted(MAN, pose, at), 'walker')?.sprite.scale).toBe(1)
      expect(zoomOf(pose, at) / 2).toBeGreaterThanOrEqual(0.95)
      expect(zoomOf(pose, at) / 2).toBeLessThan(1.1)
    }
  })

  it('draws the stander, whom the camera does not follow, at one pixel a texel the whole lap', () => {
    for (const [x, z] of CORNERS) {
      const pose = camera([x, 0, z], SIZE)
      const at: V3 = [0, 0, 0]
      expect(place(pose, at, painted(MAN, pose, at), 'stander')?.sprite.scale).toBe(1)
    }
  })

  it('is nearer true scale at this size than at 640 × 360 and 480 × 270, where a texel is minified a little', () => {
    const [here, middle, small] = [SIZE, [640, 360], [480, 270]].map((size) =>
      walkerZoom(size as [number, number]),
    )
    // The numbers the size was chosen by: about 0.67 (480 × 270), 0.90 (640 × 360), 1.01 (720 × 405) of a pixel a texel.
    expect(small).toBeLessThan(0.7)
    expect(middle).toBeGreaterThan(0.85)
    expect(middle).toBeLessThan(0.95)
    expect(Math.abs(1 - (here ?? 0))).toBeLessThan(Math.abs(1 - (middle ?? 0)))
    expect(Math.abs(1 - (middle ?? 0))).toBeLessThan(Math.abs(1 - (small ?? 0)))
    expect(here).toBeGreaterThanOrEqual(1)
  })
})
