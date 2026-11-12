// The time of day through the graph a fresh `create-game --template 3d` game draws with: the library look (haze, grade,
// snap) and the default gameplay camera (50 mm, 30° down, 16 m back) following the player, on a real WebGL2 context.
// `time-of-day.parity.test.ts` checks the light with neither (a fixed camera 5 m away, no look), which is how the night
// came to draw brighter than the day under the haze with nothing failing (docs/superpowers/audits/
// 2026-11-12-3d-night-regression). Here the room must be darker at night and still read: the crate stands out of the
// floor around it, by day and by night, not under a flat veil.
import '#src/entries/no-eval.ts'
import type { RenderRow, StepResult } from '@automata/sim'
import { afterEach, describe, expect, it } from 'vitest'
import { createPixi3dRenderer } from '#src/app/create-renderer.ts'
import { cameraView } from '#src/features/camera/sim/camera-view.schema.ts'
import { DEFAULT_LOOK } from '#src/features/look/look.ts'
import { box } from '#src/shared/render/views/box-view.ts'
import { timeOfDay } from '#src/shared/time-of-day/time-of-day.ts'
import { builtRenderer } from '#src/testing/built-renderer.ts'
import { snapshot } from '#src/testing/snapshot.ts'
import { testTarget } from '#src/testing/test-target.ts'

const hasWebGL2 = document.createElement('canvas').getContext('webgl2') !== null
const step = (render: StepResult['render']): StepResult => ({ tick: 0, events: [], render, rejected: [] })

// The template's room in miniature, in its swatches' colours (DUEL dusk 4 floor, dusk 1 walls, mud 3 crate): a 10 by
// 8 m floor, the far wall and the two side walls 3 m high (the camera looks toward +z, so the near wall would stand
// between it and the player, where the occluder rule cuts the template's), a crate beside the player, and the player.
const at = (sid: number, id: string, x: number, y: number, z: number): RenderRow => ({
  sid,
  components: { [id]: { x, y, z } },
})
const ROOM: readonly RenderRow[] = [
  at(1, 'floor', 0, -0.2, 2),
  at(2, 'far-wall', 0, 0, 6.1),
  at(3, 'side-wall', -5.1, 0, 2),
  at(4, 'side-wall', 5.1, 0, 2),
]
const CRATE = at(5, 'crate', 2.5, 0, 2)
const PLAYER: RenderRow = {
  sid: 6,
  components: { body: { x: 0, y: 0, z: 2 }, 'camera-heading': { view: 'play', heading: 0 } },
}

let scope: { dispose(): void } | undefined
afterEach(() => {
  scope?.dispose()
  scope = undefined
  document.body.replaceChildren()
})

/** Each pixel's luminance (0..1) in a frame drawn in `time`, with or without the crate. */
async function frame(time: string, crate: boolean): Promise<Float32Array> {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const renderer = await builtRenderer(
    createPixi3dRenderer({
      logicalWidth: 160,
      logicalHeight: 90,
      look: DEFAULT_LOOK,
      time: timeOfDay(time),
      views: {
        floor: box({ width: 10, height: 0.2, depth: 8 }, { color: 0x8690b2 }),
        'far-wall': box({ width: 10.4, height: 3, depth: 0.2 }, { color: 0x3a4568 }),
        'side-wall': box({ width: 0.2, height: 3, depth: 8 }, { color: 0x3a4568 }),
        crate: box({ width: 1, height: 1, depth: 1 }, { color: 0x725a51 }),
        body: box({ width: 0.5, height: 1.62, depth: 0.3 }, { color: 0x2a6fd6 }),
      },
      camera: { views: [cameraView('play')], initial: 'play', follow: 'body' },
      scene: (view) => {
        // The template's sky and ground, drawn by day; the renderer lights them by the time.
        view.environment = { skyColor: 0xcdd2da, groundColor: 0x3b303c }
        return undefined
      },
    })(testTarget(host, {})),
  )
  scope = renderer
  const added = [...ROOM, ...(crate ? [CRATE] : []), PLAYER]
  renderer.apply(step({ resync: true, added, changed: [], removed: [] }))
  renderer.draw({ alpha: 1, frameMs: 16, paused: false })
  const pixels = snapshot(renderer)
  const out = new Float32Array(pixels.length / 4)
  for (let i = 0; i < out.length; i++)
    out[i] =
      (0.2126 * (pixels[i * 4] ?? 0) +
        0.7152 * (pixels[i * 4 + 1] ?? 0) +
        0.0722 * (pixels[i * 4 + 2] ?? 0)) /
      255
  scope.dispose()
  scope = undefined
  return out
}

const mean = (values: Float32Array): number => values.reduce((sum, v) => sum + v, 0) / values.length

/** How far the crate stands out: the mean luminance change over the pixels it covers (where the two frames differ). */
function crateContrast(withCrate: Float32Array, without: Float32Array): number {
  let sum = 0
  let count = 0
  for (let i = 0; i < withCrate.length; i++) {
    const change = Math.abs((withCrate[i] ?? 0) - (without[i] ?? 0))
    if (change > 1 / 255) {
      sum += change
      count++
    }
  }
  return count === 0 ? 0 : sum / count
}

describe.runIf(hasWebGL2)('the time of day under the look and the gameplay camera, on WebGL2', () => {
  it('draws the night darker than the day', async () => {
    const [day, night] = [mean(await frame('day', true)), mean(await frame('night', true))]
    expect(night).toBeLessThan(day * 0.8)
  })

  // Measured on SwiftShader (2026-11-12): under the unfocused haze the crate changed its pixels by 0.17 by day and 0.075
  // at night (a flat veil); focused and lit by the time, 0.22 and 0.12. Night over day was 0.91, now 0.64.
  it('keeps the crate standing out of the floor by day and by night', async () => {
    for (const time of ['day', 'night']) {
      const contrast = crateContrast(await frame(time, true), await frame(time, false))
      expect(contrast, time).toBeGreaterThan(0.1)
    }
  })
})
