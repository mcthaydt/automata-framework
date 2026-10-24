import { Application, Filter, RenderTexture, Sprite, Texture } from 'pixi.js'
import { afterEach, describe, expect, it } from 'vitest'
import { filterPrograms } from '../filter/filter-programs.js'
import { tryFilter } from '../filter/try-filter.js'

const PASS_GLSL = `in vec2 vTextureCoord;
in vec2 vPixelCoord;
out vec4 finalColor;
uniform sampler2D uTexture;
void main() {
  finalColor = texture(uTexture, vTextureCoord);
}`

// `missing` is never declared, so the fragment shader cannot compile in any engine.
const BROKEN_GLSL = `in vec2 vTextureCoord;
in vec2 vPixelCoord;
out vec4 finalColor;
uniform sampler2D uTexture;
void main() {
  finalColor = texture(uTexture, vTextureCoord) * missing;
}`

const WGSL = `
@fragment fn mainFragment(input: VSOutput) -> @location(0) vec4<f32> {
  return textureSample(uTexture, uSampler, input.uv);
}`

function filterFrom(name: string, glsl: string): Filter {
  const { glProgram, gpuProgram } = filterPrograms(name, glsl, WGSL)
  return new Filter({ glProgram, gpuProgram, resources: {} })
}

/** Renders a 1 × 1 white sprite through `filters`; what M4 spec §6 asks of a frame after a drop is that this works. */
function drawFrame(app: Application, filters: Filter[]): void {
  const sprite = new Sprite(Texture.WHITE)
  sprite.filters = filters
  const target = RenderTexture.create({ width: 1, height: 1 })
  app.renderer.render({ container: sprite, target })
  target.destroy(true)
  sprite.destroy()
}

// Headless Firefox on a machine without a GPU has no WebGL at all, even with `webgl.force-enabled`; Pixi then
// falls back to its canvas renderer, where filters do not run. The real-compile cases need WebGL2 and are skipped
// by name in such an engine; the build-throw case runs everywhere.
const hasWebgl2 = document.createElement('canvas').getContext('webgl2') !== null

describe('a filter that fails to compile (M4 spec §6, Q-b) in WebGL2', () => {
  let app: Application | undefined
  afterEach(() => {
    app?.destroy(true)
    app = undefined
  })

  async function webgl(): Promise<Application> {
    const made = new Application()
    await made.init({ preference: 'webgl', width: 4, height: 4, autoStart: false })
    app = made
    return made
  }

  it.skipIf(!hasWebgl2)(
    'Pixi itself does not throw on a broken program: it logs, so a probe render cannot detect it',
    async () => {
      const pixi = await webgl()
      const errors: unknown[] = []
      const error = console.error
      console.error = (...args: unknown[]) => void errors.push(args)
      try {
        expect(() => drawFrame(pixi, [filterFrom('broken-probe', BROKEN_GLSL)])).not.toThrow()
      } finally {
        console.error = error
      }
      expect(errors.length).toBeGreaterThan(0)
    },
  )

  it.skipIf(!hasWebgl2)(
    'tryFilter drops the broken filter with a reason, and the next frame renders',
    async () => {
      const pixi = await webgl()
      const dropped: { id: string; reason: string }[] = []
      const broken = tryFilter(
        pixi.renderer,
        'broken',
        () => filterFrom('broken', BROKEN_GLSL),
        (id, reason) => dropped.push({ id, reason }),
      )
      expect(broken).toBeUndefined()
      expect(dropped).toHaveLength(1)
      expect(dropped[0]?.id).toBe('broken')
      expect(dropped[0]?.reason).not.toBe('')

      expect(() => drawFrame(pixi, [])).not.toThrow()
    },
  )

  it('tryFilter drops a filter that throws while it is built, in every engine, and the next frame renders', async () => {
    const pixi = await webgl()
    const dropped: string[] = []
    const thrown = tryFilter(
      pixi.renderer,
      'throws',
      () => {
        throw new Error('unsupported')
      },
      (id, reason) => dropped.push(`${id}: ${reason}`),
    )
    expect(thrown).toBeUndefined()
    expect(dropped).toEqual(['throws: unsupported'])
    expect(() => drawFrame(pixi, [])).not.toThrow()
  })

  it.skipIf(!hasWebgl2)('tryFilter keeps a filter that compiles', async () => {
    const pixi = await webgl()
    const dropped: string[] = []
    const kept = tryFilter(
      pixi.renderer,
      'pass',
      () => filterFrom('pass', PASS_GLSL),
      (id) => dropped.push(id),
    )
    expect(kept).toBeInstanceOf(Filter)
    expect(dropped).toEqual([])
    if (kept) expect(() => drawFrame(pixi, [kept])).not.toThrow()
  })
})
