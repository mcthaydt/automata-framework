// A painted figure drawn by the 3D renderer (`paintedFigure` in `createPixi3dRenderer`) shows the figure builder's own
// cell, texel for texel: each base figure in each of its 8 views, under the painter's own orthographic camera at the
// review sheets' 18°, one texel to a pixel, against what the sheets draw (`standing`). Headless Firefox here has no WebGL;
// the GPU runner runs it there.
import { afterEach, describe, expect, it } from 'vitest'
import { BASE, member, standing } from '#src/shared/figure-builder/door.ts'
import { buildScene, type StageScene } from '../../fixtures/stage-scene.ts'

const hasWebGL2 = document.createElement('canvas').getContext('webgl2') !== null

let scene: StageScene | undefined
afterEach(() => {
  scene?.dispose()
  scene = undefined
})

/** The renderer drawing one base figure facing view `d`, and the pixels of the cell's rectangle. */
async function drawn(
  who: number,
  d: number,
): Promise<{ pixels: ArrayLike<number>; at: readonly [number, number] }> {
  const def = BASE[who]?.def
  if (!def) throw new Error(`no base figure ${who}`)
  let t = 0
  // The entity's yaw 0 faces −z; the sheets' view d faces d eighths of a turn from +z.
  const yaw = (d * Math.PI) / 4 - Math.PI
  scene = await buildScene({
    size: [640, 360],
    camera: 'ortho',
    figures: [{ def, at: [0, 0], yaw, options: { now: () => t } }],
  })
  // The sheets step a fresh figure three times by a sixtieth of a second.
  let pixels: ArrayLike<number> = []
  for (let i = 1; i <= 3; i++) {
    t = i / 60
    pixels = scene.draw()
  }
  const placed = scene.stage.placed[0]
  expect(placed?.sprite.scale).toBe(1)
  return { pixels, at: placed?.sprite.screen ?? [0, 0] }
}

describe.runIf(hasWebGL2)('a painted figure in the 3D renderer', () => {
  for (const [who, b] of BASE.entries())
    for (let d = 0; d < 8; d++)
      it(`${b.def.id} view ${d}: every texel is the sheets' cell's`, async () => {
        const cast = member(b.def, 2),
          [w, h] = cast.cell,
          cell = standing(cast, d)
        const { pixels, at } = await drawn(who, d)
        let wrong = 0,
          first = ''
        for (let i = 0; i < w * h; i++) {
          const x = at[0] + (i % w),
            y = at[1] + Math.floor(i / w),
            p = (y * 640 + x) * 4
          const want =
            (cell[i * 4 + 3] ?? 0) > 0 ? [cell[i * 4], cell[i * 4 + 1], cell[i * 4 + 2]] : [255, 255, 255]
          const got = [pixels[p], pixels[p + 1], pixels[p + 2]]
          if (want.some((v, k) => v !== got[k])) {
            wrong++
            if (!first) first = `(${i % w}, ${Math.floor(i / w)}) want ${want} got ${got}`
          }
        }
        expect(wrong, first).toBe(0)
      })
})
