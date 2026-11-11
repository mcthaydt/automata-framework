// What ends the look's chain on WebGPU. `@pixi/3d` keeps one global bind group per view, and a pass that samples a depth
// (every `PostEffect` does by default, used or not: the haze, the sky, the outline) leaves that texture bound in it. The
// next frame's opaque pass attaches the scene's depth writable under the same binding, and WebGPU rejects the frame
// ('Texture "sceneDepth" usage (TextureBinding|RenderAttachment) includes writable usage and another usage in the same
// synchronization scope'): the canvas keeps the first frame that was valid, so a camera that moves afterwards never shows.
// Two rules keep the binding clean:
// - the pass that presents to the canvas samples no scene depth (the snap's and `PresentEffect`'s own passes read colour);
// - when any pass before it sampled one, `PresentEffect` is last and samples the engine's empty depth in its place.

import {
  DEPTH_VIEW_PLACEHOLDER,
  type EffectFragment,
  type EffectIO,
  FullscreenPass,
  PostEffect,
  type RenderGraph,
} from '@pixi/3d'
import type { UniformGroup } from 'pixi.js'

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

/**
 * Copies the frame to the canvas unchanged and, on WebGPU, puts the engine's empty depth back in the opaque-depth slot
 * the passes before it may have pointed at the scene's depth. WebGL has no such rule and no change.
 */
export class PresentEffect extends PostEffect {
  protected override readonly fragment: EffectFragment = PASS_THROUGH
  protected override readonly uniforms = null

  override build(graph: RenderGraph, io: EffectIO): void {
    const webgl = 'gl' in io.renderer
    graph.addPass(
      new FullscreenPass({
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
