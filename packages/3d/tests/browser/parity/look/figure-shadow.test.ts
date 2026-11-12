// A figure's cast shadow on a real context: the floor under a figure is darker than the same floor with the look's `shadow` switch
// off, in whole DUEL steps (the snap after the shadow cuts the multiplied light), and nowhere else is changed. Headless Firefox here has
// no WebGL, so these skip there.
import '#src/entries/no-eval.ts'
import { DEFAULT_PALETTE } from '@automataframework/content/palette'
import { afterEach, describe, expect, it } from 'vitest'
import { createPixi3dRenderer, type Pixi3dRenderer } from '#src/app/create-renderer.ts'
import { DEFAULT_LOOK, parseLook } from '#src/features/look/look.ts'
import type { Silhouette } from '#src/shared/render/light/figure-shadow.ts'
import { sceneLightingSchema } from '#src/shared/render/light/scene-lighting.schema.ts'
import { timeOfDay } from '#src/shared/time-of-day/time-of-day.ts'
import { builtRenderer } from '#src/testing/built-renderer.ts'
import { snapshot } from '#src/testing/snapshot.ts'
import { testTarget } from '#src/testing/test-target.ts'

const hasWebGL2 = document.createElement('canvas').getContext('webgl2') !== null
const WIDTH = 160
const HEIGHT = 100
const frame = { alpha: 1, frameMs: 16, paused: false }

let scope: { dispose(): void } | undefined
afterEach(() => {
  scope?.dispose()
  scope = undefined
  document.body.replaceChildren()
})

/** A figure of 20 × 60 texels at 3 cm (0.6 m by 1.8 m), all of it opaque, standing on the middle of its bottom row. */
const slab: Silhouette = (() => {
  const rgba = new Uint8ClampedArray(20 * 60 * 4)
  for (let k = 0; k < 20 * 60; k++) rgba[k * 4 + 3] = 255
  return { key: 'slab', width: 20, height: 60, rgba, anchor: [10, 60], metresPerTexel: 0.03, pitch: 0 }
})()

/** The sun on the left and behind, high enough to cast: a figure's shadow lies to the right of it and away from the camera. */
const SUN = { dir: [-1, 1.2, 0.6] as [number, number, number], color: 0xffffff, level: 0.5, shadow: true }

/**
 * Draws a grey floor from above and behind with a shadow cast from a figure at the origin, or none; returns the frame and where
 * the floor's points are on it. `shadow` is the look's own switch.
 */
async function draw(
  shadow: boolean,
): Promise<{ pixels: ArrayLike<number>; at: (x: number, z: number) => number }> {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const lighting = sceneLightingSchema.parse({
    ambient: 0.7,
    colorSpace: 'srgb',
    sun: SUN,
    // The floor the figure stands on, 8 m square at the feet's height, facing up.
    planes: [{ x: 0, y: 0, z: 0, normal: [0, 1, 0], width: 8, height: 8 }],
  })
  const renderer: Pixi3dRenderer = await builtRenderer(
    createPixi3dRenderer({
      logicalWidth: WIDTH,
      logicalHeight: HEIGHT,
      backgroundColor: 0x000000,
      views: {},
      lighting,
      time: timeOfDay('day'),
      look: parseLook({ ...DEFAULT_LOOK, switches: { ...DEFAULT_LOOK.switches, shadow } }),
      scene: (view, _stage, occluders, light) => {
        view.environment = { skyColor: 0xcdd2da, groundColor: 0x808080 }
        // A thin lit slab for the floor, and the camera looking down at the origin from 5 m up and 5 m back, 45° down.
        occluders.box({ min: [-4, -0.1, -4], max: [4, 0, 4] }, 0x909090)
        view.camera.mode = 'orthographic'
        view.camera.orthographicSize = 2.5
        view.camera.position.set(0, 5, 5)
        view.camera.lookAt({ x: 0, y: 0, z: 0 })
        // A figure's node at its feet; its shadow is the room's, as a painted figure takes it.
        light?.shadows?.add(view.root).cast({ silhouette: slab, at: [0, 0, 0], right: [1, 0] })
        return undefined
      },
    })(testTarget(host)),
  )
  scope = renderer
  renderer.draw(frame)
  const pixels = snapshot(renderer)
  // The frame's own height: the field is letterboxed into the page, so it is not always `HEIGHT`.
  const rows = pixels.length / 4 / WIDTH
  // The ground point (x, 0, z): 2.5 m across the half height, looking 45° down, so z is foreshortened by sin 45°.
  const metre = rows / 2 / 2.5
  const at = (x: number, z: number): number =>
    (Math.round(rows / 2 + z * metre * Math.SQRT1_2) * WIDTH + Math.round(WIDTH / 2 + x * metre)) * 4
  return { pixels, at }
}

const luma = (p: ArrayLike<number>, at: number): number =>
  ((p[at] ?? 0) + (p[at + 1] ?? 0) + (p[at + 2] ?? 0)) / 3
const colourAt = (p: ArrayLike<number>, at: number): number =>
  ((p[at] ?? 0) << 16) | ((p[at + 1] ?? 0) << 8) | (p[at + 2] ?? 0)
const PALETTE = new Set(DEFAULT_PALETTE.colors.map((hex) => Number.parseInt(hex.slice(1), 16)))

describe.runIf(hasWebGL2)('a figure’s cast shadow on WebGL2', () => {
  it('darkens the floor under the figure, and with the look’s switch off it does not', async () => {
    const on = await draw(true)
    const off = await draw(false)
    // Under the feet (the contact shadow) and a metre to the right and 0.6 m behind (the sun's, thrown from the left and behind:
    // a point 1.2 m up the figure falls at 1 m along and 0.6 m back).
    for (const [x, z] of [
      [0, 0],
      [1, -0.6],
    ] as const) {
      const lit = luma(on.pixels, on.at(x, z))
      const bare = luma(off.pixels, off.at(x, z))
      expect(
        lit,
        `the floor at (${x}, ${z}) with the shadow on (${lit}) is darker than with it off (${bare})`,
      ).toBeLessThan(bare - 8)
    }
    // Two renderers on software GL: about 5 s alone, over 15 s when the suite's files draw at once.
  }, 60_000)

  it('leaves the rest of the floor as it was: a metre to the left, and in front of the figure', async () => {
    const on = await draw(true)
    const off = await draw(false)
    for (const [x, z] of [
      [-1.5, 0],
      [0, 1.5],
      [2.9, 1],
    ] as const)
      expect(colourAt(on.pixels, on.at(x, z)), `the floor at (${x}, ${z})`).toBe(
        colourAt(off.pixels, off.at(x, z)),
      )
  }, 60_000)

  it('moves the floor whole DUEL steps: the shadowed pixel is a palette colour, not a grey in between', async () => {
    const on = await draw(true)
    expect(PALETTE.has(colourAt(on.pixels, on.at(0, 0)))).toBe(true)
  }, 60_000)
})
