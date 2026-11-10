// A painted figure drawn by the 3D renderer (`paintedFigure` in `createPixi3dRenderer`) shows the painter's own cell,
// texel for texel: each base figure in each of its 8 views, under an orthographic camera at the sheets' 18°, one texel
// to a pixel, against what the review sheets draw (`standing`). Headless Firefox here has no WebGL; the GPU runner runs it.
import '#src/entries/no-eval.ts'
import type { StepResult } from '@automata/sim'
import { afterEach, describe, expect, it } from 'vitest'
import { createPixi3dRenderer, type Pixi3dRenderer } from '#src/app/create-renderer.ts'
import { BASE, member, paintedFigure, standing } from '#src/entries/painted.ts'
import { builtRenderer } from '#src/testing/built-renderer.ts'
import { snapshot } from '#src/testing/snapshot.ts'
import { testTarget } from '#src/testing/test-target.ts'

const hasWebGL2 = document.createElement('canvas').getContext('webgl2') !== null
const BACKGROUND = 0xffffff
const step = (render: StepResult['render']): StepResult => ({ tick: 0, events: [], render, rejected: [] })
const PITCH = (18 * Math.PI) / 180

let scope: { dispose(): void } | undefined
afterEach(() => {
  scope?.dispose()
  scope = undefined
  document.body.replaceChildren()
})

/** The renderer drawing one base figure facing view `d`, the camera as the sheets' (a texel a pixel). */
async function drawn(who: number, d: number): Promise<{ pixels: ArrayLike<number>; width: number }> {
  const def = BASE[who]!.def
  const cast = member(def, 2),
    [w, h] = cast.cell,
    ppm = h / cast.metres
  const aim = (h / 2 - cast.feet) / ppm / Math.cos(PITCH)
  let t = 0
  const host = document.createElement('div')
  host.style.width = `${w}px`
  host.style.height = `${h}px`
  document.body.appendChild(host)
  const factory = createPixi3dRenderer({
    logicalWidth: w,
    logicalHeight: h,
    backgroundColor: BACKGROUND,
    views: { hero: paintedFigure(def, { now: () => t }) },
    scene: (view) => {
      view.camera.mode = 'orthographic'
      view.camera.orthographicSize = w / 2 / ppm
      view.camera.position.set(0, aim + 20 * Math.sin(PITCH), 20 * Math.cos(PITCH))
      view.camera.lookAt({ x: 0, y: aim, z: 0 })
      return undefined
    },
  })
  const renderer: Pixi3dRenderer = await builtRenderer(factory(testTarget(host, {}, { width: w, height: h })))
  scope = renderer
  // The entity's yaw 0 faces −z; the sheets' view d faces d eighths of a turn from +z.
  const yaw = (d * Math.PI) / 4 - Math.PI
  renderer.apply(
    step({
      resync: true,
      added: [{ sid: 1, components: { hero: { x: 0, y: 0, z: 0, yaw } } }],
      changed: [],
      removed: [],
    }),
  )
  // The sheets step a fresh figure three times by a sixtieth of a second.
  for (let i = 1; i <= 3; i++) {
    t = i / 60
    renderer.draw({ alpha: 1, frameMs: 16, paused: false })
  }
  return { pixels: snapshot(renderer), width: renderer.stage.app.renderer.width }
}

describe.runIf(hasWebGL2)('a painted figure in the 3D renderer', () => {
  for (const [who, b] of BASE.entries())
    for (let d = 0; d < 8; d++)
      it(`${b.def.id} view ${d}: every texel is the sheets' cell's`, async () => {
        const cast = member(b.def, 2),
          [w, h] = cast.cell,
          cell = standing(cast, d)
        const { pixels, width } = await drawn(who, d)
        expect(width).toBe(w)
        let wrong = 0,
          first = ''
        for (let i = 0; i < w * h; i++) {
          const want =
            (cell[i * 4 + 3] ?? 0) > 0 ? [cell[i * 4], cell[i * 4 + 1], cell[i * 4 + 2]] : [255, 255, 255]
          const got = [pixels[i * 4], pixels[i * 4 + 1], pixels[i * 4 + 2]]
          if (want.some((v, k) => v !== got[k])) {
            wrong++
            if (!first) first = `(${i % w}, ${Math.floor(i / w)}) want ${want} got ${got}`
          }
        }
        expect(wrong, first).toBe(0)
      })
})
