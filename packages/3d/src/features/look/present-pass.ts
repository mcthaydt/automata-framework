// What ends the look's chain on WebGPU. `@pixi/3d` keeps one global bind group per view, and a pass that samples a depth
// (every `PostEffect` does by default, used or not: the haze, the sky, the outline) leaves that texture bound in it. The
// next frame's opaque pass attaches the scene's depth writable under the same binding, and WebGPU rejects the frame
// ('Texture "sceneDepth" usage (TextureBinding|RenderAttachment) includes writable usage and another usage in the same
// synchronization scope'): the canvas keeps the first frame that was valid, so a camera that moves afterwards never shows.
// Two rules keep the binding clean:
// - the pass that presents to the canvas samples no scene depth (the snap's and `PresentEffect`'s own passes read colour);
// - when any pass before it sampled one, `PresentEffect` is last and samples the engine's empty depth in its place.
// WebGL has a hazard of its own, found by WebKit (ANGLE) on the world kit's sky: the first frame the look presents attaches
// a depth to the canvas's framebuffer, a texture the renderer leaves bound on a unit; the next draw that samples every unit
// (the 2D stage's sprite batch, `uTextures[32]`) then reads a texture its own framebuffer is attached to, which is a
// feedback loop ('Feedback loop formed between Framebuffer and active Texture'). So on WebGL the present pass, the last
// thing the 3D view draws, puts the engine's empty texture back on the units after its draw.

import {
  DEPTH_VIEW_PLACEHOLDER,
  type EffectFragment,
  type EffectIO,
  FullscreenPass,
  PostEffect,
  type RenderGraph,
} from '@pixi/3d'
import { type Texture as PixiTexture, Texture, type UniformGroup } from 'pixi.js'

/** One full-screen pass over `io.input` that reads colour only, so it leaves the depth binding as it found it. */
export function addColourOnlyPass(
  graph: RenderGraph,
  io: EffectIO,
  label: string,
  fragment: EffectFragment,
  uniforms: UniformGroup | null,
): void {
  graph.addPass(
    new FullscreenPass({
      renderer: io.renderer,
      label,
      fragment,
      uniforms,
      reads: { color: io.input },
      writes: io.output,
    }),
  )
}

const PASS_THROUGH: EffectFragment = {
  gpu: 'fn effect(uv: vec2<f32>) -> vec4<f32> { return sampleColor(uv); }',
  gl: 'vec4 effect(vec2 uv) { return sampleColor(uv); }',
}

/** WebGL2 guarantees 16 texture units; the stage's sprite batch samples them all. */
const TEXTURE_UNITS = 16

/** The present pass: on WebGL, once it has drawn, no unit holds a texture the canvas's framebuffer could be attached to. */
class PresentPass extends FullscreenPass {
  readonly #release: ((unit: number) => void) | undefined

  constructor(options: ConstructorParameters<typeof FullscreenPass>[0]) {
    super(options)
    const renderer = options.renderer as unknown as {
      texture?: { bind(texture: PixiTexture, unit: number): void }
    }
    this.#release =
      'gl' in options.renderer ? (unit) => renderer.texture?.bind(Texture.EMPTY, unit) : undefined
  }

  override render(session: Parameters<FullscreenPass['render']>[0]): void {
    super.render(session)
    if (this.#release) for (let unit = 0; unit < TEXTURE_UNITS; unit++) this.#release(unit)
  }
}

/**
 * Copies the frame to the canvas unchanged and, on WebGPU, puts the engine's empty depth back in the opaque-depth slot
 * the passes before it may have pointed at the scene's depth. On WebGL it leaves the texture units empty (see the top).
 */
export class PresentEffect extends PostEffect {
  protected override readonly fragment: EffectFragment = PASS_THROUGH
  protected override readonly uniforms = null

  constructor() {
    // Works on the picture as shown, so it runs after tone mapping (@pixi/3d beta.3 stages a post effect before it by default).
    super({ stage: 'afterToneMapping' })
  }

  override build(graph: RenderGraph, io: EffectIO): void {
    const webgl = 'gl' in io.renderer
    graph.addPass(
      new PresentPass({
        renderer: io.renderer,
        label: 'PresentEffect',
        fragment: this.fragment,
        reads: webgl
          ? { color: io.input }
          : { color: io.input, depth: graph.importDepth(() => DEPTH_VIEW_PLACEHOLDER as never) },
        writes: io.output,
      }),
    )
  }
}
