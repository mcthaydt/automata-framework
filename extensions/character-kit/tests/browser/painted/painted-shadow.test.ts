// A painted figure's cast shadow on a lit floor, on a real GPU: the room's floor is darker under and beside the figure than the
// same frame with the look's `shadow` switch off, nothing else in the frame moves, and the shadow follows the figure's silhouette
// (the sun's) as the builder throws it. Headless Firefox here has no WebGL; the GPU runner runs it there.
import { DEFAULT_LOOK, type Look, sceneLightingSchema } from '@automata/3d'
import { afterEach, describe, expect, it } from 'vitest'
import { BASE, type CharacterDef } from '#src/shared/figure-builder/door.ts'
import { buildScene, type StageScene } from '../../fixtures/stage-scene.ts'

const hasWebGL2 = document.createElement('canvas').getContext('webgl2') !== null
const MAN = (BASE[0] as { def: CharacterDef }).def
const SIZE = [640, 360] as const
/**
 * A sun from the left and a little behind, over an 8 m floor at y 0 (the plane a shadow may fall on): the man's shadow lies to his
 * right and away from the camera.
 */
const SUNLIT = sceneLightingSchema.parse({
  ambient: 0.6,
  sun: { dir: [-1, 1.2, 0.6], color: 0xffffff, level: 0.5, shadow: true },
  planes: [{ x: 0, y: 0, z: 0, normal: [0, 1, 0], width: 8, height: 8 }],
})
/** The look with only the shadow's switch to vary: no dither, grade or outline, so a pixel is the floor's colour or its shadow's. */
const look = (shadow: boolean): Look => ({
  ...DEFAULT_LOOK,
  switches: { outline: false, grade: false, dither: false, haze: false, shadow },
})
const FLOOR = { size: [12, 0.1, 12] as const, at: [0, -0.1, 0] as const, color: 0x909090 }

let scene: StageScene | undefined
afterEach(() => {
  scene?.dispose()
  scene = undefined
})

/** The frame with the man at the origin, drawn with the shadow's switch as given. */
async function frameOf(
  shadow: boolean,
): Promise<{ pixels: Uint8ClampedArray; feet: readonly [number, number] }> {
  scene = await buildScene({
    size: SIZE,
    camera: 'ortho',
    figures: [{ def: MAN, at: [0, 0] }],
    boxes: [FLOOR],
    lighting: SUNLIT,
    passes: look(shadow),
  })
  const pixels = Uint8ClampedArray.from(scene.draw())
  const sprite = scene.frame().sprites[0]
  if (sprite === undefined) throw new Error('the man was not placed')
  const feet: [number, number] = [
    sprite.screen[0] + sprite.scale * sprite.cell.anchor[0],
    sprite.screen[1] + sprite.scale * sprite.cell.anchor[1],
  ]
  scene.dispose()
  scene = undefined
  return { pixels, feet }
}

const luma = (p: ArrayLike<number>, k: number): number =>
  ((p[k * 4] ?? 0) + (p[k * 4 + 1] ?? 0) + (p[k * 4 + 2] ?? 0)) / 3

describe.runIf(hasWebGL2)('a painted figure’s cast shadow on a lit floor', () => {
  it('darkens the floor round the figure and moves nothing else: every pixel that differs from the switch off is darker', async () => {
    const on = await frameOf(true)
    const off = await frameOf(false)
    let changed = 0
    let brighter = 0
    const fx = on.feet[0]
    let left = Number.POSITIVE_INFINITY
    let right = Number.NEGATIVE_INFINITY
    for (let k = 0; k < SIZE[0] * SIZE[1]; k++) {
      const [a, b] = [luma(on.pixels, k), luma(off.pixels, k)]
      if (a === b) continue
      changed += 1
      if (a > b) brighter += 1
      const x = k % SIZE[0]
      left = Math.min(left, x)
      right = Math.max(right, x)
    }
    // The contact ellipse alone is some 0.6 m × 0.32 m of floor, a few hundred pixels at the painter's 74 px a metre; the sun's
    // silhouette is many times that.
    expect(changed).toBeGreaterThan(400)
    expect(brighter).toBe(0)
    // The sun is on the left, so the shadow runs to the figure's right: further right of the feet than left of them.
    expect(right - fx, `the shadow reaches ${right - fx} px right of the feet`).toBeGreaterThan(fx - left)
  })
})
