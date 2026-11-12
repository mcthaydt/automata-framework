// The scene of the texel-lattice tests (tests/browser/painted/painted-grid.test.ts and its WebGPU twin): the base woman painted at
// density 2 and drawn at 2 field pixels a texel, the field shown at 2x under a screen filter that draws a black line on every device
// pixel whose index from the field's origin is 3 mod 4 (what `@automata/lcd-panel`'s screen filter does with a 4-pixel cell).
import '@automata/3d/no-eval'
import { createPixi3dRenderer, type Pixi3dRenderer } from '@automata/3d'
import { builtRenderer, testTarget } from '@automata/3d/testing-checks'
import { postFilter } from '@automata/framework'
import type { View3D } from '@pixi/3d'
import { paintedFigure } from '#src/features/painted/painted-view.ts'
import { BASE, type CharacterDef } from '#src/shared/figures/door.ts'
import { aim, step } from './stage-scene.ts'

export const FIELD = [320, 180] as const
const WOMAN = BASE[1]?.def as CharacterDef
// Black on the last device pixel of every 4-pixel cell from the field's origin, both axes.
const MESH = postFilter('test-mesh', {
  at: 'screen',
  glsl: `in vec2 vTextureCoord;
out vec4 finalColor;
uniform sampler2D uTexture;
uniform vec4 uInputPixel;
void main() {
  vec2 d = floor(vTextureCoord * uInputPixel.xy - uScreenOrigin);
  vec2 l = d - 4.0 * floor(d / 4.0);
  vec4 c = texture(uTexture, vTextureCoord);
  finalColor = (l.x == 3.0 || l.y == 3.0) ? vec4(0.0, 0.0, 0.0, c.a) : c;
}`,
  wgsl: `@fragment fn mainFragment(input: VSOutput) -> @location(0) vec4<f32> {
  let d = floor(input.uv * gfu.uInputPixel.xy - screen.uScreenOrigin);
  let l = d - 4.0 * floor(d / 4.0);
  let c = textureSample(uTexture, uSampler, input.uv);
  if (l.x == 3.0 || l.y == 3.0) { return vec4<f32>(0.0, 0.0, 0.0, c.a); }
  return c;
}`,
})

/** The renderer `frameOf` made last; the test disposes it. */
export let open: Pixi3dRenderer | undefined

/** Disposes the last renderer and clears the page. */
export function closeGridScene(): void {
  open?.dispose()
  open = undefined
  document.body.replaceChildren()
}

/** The woman at `x` metres, painted at density 2 and drawn at 2 field pixels a texel, the field at 2x; the canvas as presented. */
export async function frameOf(x: number, grid: boolean, preference?: 'webgpu'): Promise<Uint8ClampedArray> {
  const host = document.body.appendChild(document.createElement('div'))
  const made = await builtRenderer(
    createPixi3dRenderer({
      logicalWidth: FIELD[0],
      logicalHeight: FIELD[1],
      backgroundColor: 0xffffff,
      barFraction: 0,
      ...(preference ? { preference } : {}),
      postFilters: [MESH],
      views: { fig: paintedFigure(WOMAN, { now: () => 0, density: 2, lit: false, grid }) },
      // The painter's orthographic view at twice its pixels a metre: a density-2 texel is two field pixels.
      scene: (view: View3D) => void aim(view, [FIELD[0] / 2, FIELD[1]], 'ortho', 0, 0),
    })(testTarget(host, {}, { width: FIELD[0] * 2, height: FIELD[1] * 2 })),
  )
  open = made
  made.apply(
    step({
      resync: true,
      added: [{ sid: 1, components: { fig: { x, y: 0, z: 0, yaw: Math.PI } } }],
      changed: [],
      removed: [],
    }),
  )
  for (let i = 0; i < 3; i++) made.draw({ alpha: 1, frameMs: 16, paused: false })
  const canvas = made.stage.app.canvas as HTMLCanvasElement
  const copy = document.createElement('canvas')
  copy.width = canvas.width
  copy.height = canvas.height
  const context = copy.getContext('2d') as CanvasRenderingContext2D
  context.drawImage(canvas, 0, 0)
  return context.getImageData(0, 0, copy.width, copy.height).data
}

/** The 4-by-4 blocks whose inner 3 by 3 device pixels are not all one colour, as "column,row" of the block. */
export function splitBlocks(px: Uint8ClampedArray): { split: string[]; figure: number } {
  const width = FIELD[0] * 2
  const at = (x: number, y: number): number => {
    const i = (y * width + x) * 4
    return ((px[i] ?? 0) << 16) | ((px[i + 1] ?? 0) << 8) | (px[i + 2] ?? 0)
  }
  const split: string[] = []
  let figure = 0
  for (let by = 0; by < FIELD[1] / 2; by++)
    for (let bx = 0; bx < FIELD[0] / 2; bx++) {
      const first = at(bx * 4, by * 4)
      let one = true
      for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) one &&= at(bx * 4 + x, by * 4 + y) === first
      if (!one) split.push(`${bx},${by}`)
      if (first !== 0xffffff) figure++
    }
  return { split, figure }
}
