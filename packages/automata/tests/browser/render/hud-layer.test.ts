import { Graphics } from 'pixi.js'
import { afterEach, describe, expect, it } from 'vitest'
import { postFilter } from '#src/features/render/filter/post-filter.ts'
import { disposeAll, frame, rgbAt, startRenderer } from '../hud-text/harness.ts'

// The hud layer on a real WebGL2 renderer: it sits above the pixel picture, outside every post filter, and the
// field's mask clips it (spec D1).
const HALVE_GLSL = `in vec2 vTextureCoord;
in vec2 vPixelCoord;
out vec4 finalColor;
uniform sampler2D uTexture;
void main() {
  finalColor = texture(uTexture, vTextureCoord) * 0.5;
}`
const HALVE_WGSL = `
@fragment fn mainFragment(input: VSOutput) -> @location(0) vec4<f32> {
  return vec4<f32>(0.5, 0.5, 0.5, 0.5);
}`

const hasWebgl2 = document.createElement('canvas').getContext('webgl2') !== null

describe.skipIf(!hasWebgl2)('the hud layer', () => {
  afterEach(disposeAll)

  it('is untouched by a post filter that changes a square on ui', async () => {
    const { renderer } = await startRenderer({
      view: { width: 400, height: 200 },
      logical: { width: 200, height: 100 },
      dpr: 1,
      postFilters: [postFilter('halve', { glsl: HALVE_GLSL, wgsl: HALVE_WGSL })],
    })
    renderer.stage.ui.addChild(new Graphics().rect(20, 40, 20, 20).fill(0xffffff))
    renderer.stage.hud.addChild(new Graphics().rect(100, 40, 20, 20).fill(0xffffff))
    const shot = frame(renderer)
    // Logical (30, 50) is CSS (60, 100) at scale 2; logical (110, 50) is CSS (220, 100).
    expect(rgbAt(shot, 1, 220, 100)).toEqual([255, 255, 255])
    const [r = 255] = rgbAt(shot, 1, 60, 100)
    expect(r).toBeLessThan(200)
  })

  it('is clipped at the bottom of the field', async () => {
    // Portrait phone: the bars are hidden, so the mask is the only thing that stops the hud at the field's edge.
    const { renderer } = await startRenderer({
      view: { width: 360, height: 640 },
      logical: { width: 180, height: 90 },
      dpr: 1,
    })
    const geometry = renderer.stage.frame?.layout(360, 640)
    if (!geometry) throw new Error('no letterbox')
    const fieldBottom = geometry.y + geometry.height
    expect(fieldBottom).toBeLessThan(640)
    renderer.stage.hud.addChild(new Graphics().rect(0, 0, 180, 1000).fill(0xffffff))
    const shot = frame(renderer)
    expect(rgbAt(shot, 1, 100, fieldBottom - 4)).toEqual([255, 255, 255])
    expect(rgbAt(shot, 1, 100, fieldBottom + 4)).toEqual([0, 0, 0])
  })
})
