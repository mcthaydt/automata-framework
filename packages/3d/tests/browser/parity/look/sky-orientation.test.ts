// Which way up the sky is. `SkyEffect` derives a pixel's elevation from `uFxClip.w`, the projection's vertical size; on `@pixi/3d`
// 0.1.0-beta.3 that is negative where the view draws into a texture, and a signed divide turns the sky over. No test saw a sky pixel before
// (sky-palette.test.ts leaves the frame on the palette, which an upside-down sky also does). The scene is `src/testing/sky-frame.ts`; the
// WebGPU twin is `tests/browser/webgpu/sky-orientation.test.ts`.
import '#src/entries/no-eval.ts'
import { describe, expect, it } from 'vitest'
import { shootSky, skyMisses } from '#src/testing/sky-frame.ts'

const hasWebGL2 = document.createElement('canvas').getContext('webgl2') !== null

describe.runIf(hasWebGL2)('the sky on WebGL2: which way up', () => {
  it('draws the haze below the horizon and the time’s bands above it, with the camera level', async () => {
    expect(skyMisses(await shootSky('webgl2'))).toEqual([])
  })
})
