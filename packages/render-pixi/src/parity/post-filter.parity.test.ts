import type { RenderTarget } from '@mcthaydt/automata-runtime'
import { Effect, Exit, Scope } from 'effect'
import { Graphics } from 'pixi.js'
import { afterEach, describe, expect, it } from 'vitest'
import { postFilter } from '../filter/post-filter.js'
import { createPixiRenderer } from '../renderer.js'

// A declared `postFilter` on a real renderer (PRODUCT spec §2 F1, M4 spec §6): it builds, it is in the slot, and the
// picture shows it; one that cannot compile is left out and the others still draw.
const FLAT_RED_GLSL = `in vec2 vTextureCoord;
in vec2 vPixelCoord;
out vec4 finalColor;
uniform sampler2D uTexture;
void main() {
  finalColor = vec4(1.0, 0.0, 0.0, 1.0);
}`

// `missing` is never declared, so the fragment shader cannot compile in any engine.
const BROKEN_GLSL = `in vec2 vTextureCoord;
in vec2 vPixelCoord;
out vec4 finalColor;
uniform sampler2D uTexture;
void main() {
  finalColor = texture(uTexture, vTextureCoord) * missing;
}`

const FLAT_RED_WGSL = `
@fragment fn mainFragment(input: VSOutput) -> @location(0) vec4<f32> {
  return vec4<f32>(1.0, 0.0, 0.0, 1.0);
}`

// Headless Firefox on a machine without a GPU has no WebGL at all; Pixi then falls back to its canvas renderer,
// where filters do not run (see render-quality.parity.test.ts).
const hasWebgl2 = document.createElement('canvas').getContext('webgl2') !== null

const SIZE = 8
const geometry = {
  usable: { x: 0, y: 0, width: SIZE, height: SIZE },
  formFactor: 'desktop',
}

describe.skipIf(!hasWebgl2)('declared post filters in WebGL2', () => {
  const scopes: Scope.CloseableScope[] = []
  afterEach(async () => {
    for (const scope of scopes.splice(0)) await Effect.runPromise(Scope.close(scope, Exit.void))
  })

  async function start(filters: ReturnType<typeof postFilter>[]) {
    const dropped: unknown[] = []
    const target = {
      host: document.body.appendChild(document.createElement('div')),
      geometry: { geometry: { current: geometry }, onChange: () => () => {} },
      assets: { get: () => undefined },
      bus: {
        publish: (name: string, fact: unknown) => void dropped.push([name, fact]),
        subscribe: () => () => {},
      },
    } as unknown as RenderTarget
    const scope = Effect.runSync(Scope.make())
    scopes.push(scope)
    const renderer = await Effect.runPromise(
      Scope.extend(createPixiRenderer({ preference: 'webgl', postFilters: filters })(target), scope),
    )
    // Something to filter: a white square over the whole 8 × 8 screen.
    renderer.stage.world.addChild(new Graphics().rect(0, 0, SIZE, SIZE).fill(0xffffff))
    return { renderer, dropped }
  }

  /** The red, green and blue of the pixel at (2, 2) after a frame. */
  function pixelAfterFrame(renderer: Awaited<ReturnType<typeof start>>['renderer']): number[] {
    renderer.draw({ alpha: 1, frameMs: 16, paused: false })
    const { pixels, width } = renderer.stage.app.renderer.extract.pixels({ target: renderer.stage.app.stage })
    const at = (2 * width + 2) * 4
    return [pixels[at] ?? -1, pixels[at + 1] ?? -1, pixels[at + 2] ?? -1]
  }

  it('shows in the picture: a flat red filter turns the white square red', async () => {
    const { renderer, dropped } = await start([
      postFilter('flat-red', { glsl: FLAT_RED_GLSL, wgsl: FLAT_RED_WGSL }),
    ])
    expect(renderer.stage.postFilters.ids).toEqual(['flat-red'])
    expect(dropped).toEqual([])
    expect(pixelAfterFrame(renderer)).toEqual([255, 0, 0])
  })

  it('leaves out one that cannot compile, reports it, and the others still draw', async () => {
    const { renderer, dropped } = await start([
      postFilter('broken', { glsl: BROKEN_GLSL, wgsl: FLAT_RED_WGSL }),
      postFilter('flat-red', { glsl: FLAT_RED_GLSL, wgsl: FLAT_RED_WGSL }),
    ])
    expect(renderer.stage.postFilters.ids).toEqual(['flat-red'])
    expect(dropped).toEqual([['render.filter.dropped', expect.objectContaining({ id: 'broken' })]])
    expect(pixelAfterFrame(renderer)).toEqual([255, 0, 0])
  })
})
