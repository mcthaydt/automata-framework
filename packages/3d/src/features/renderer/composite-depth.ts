import type { PixiStage, PixiStageHooks } from '@automata/framework'
import type { WebGLRenderer } from 'pixi.js'

/**
 * Keeps the composite's depth texture off every sampler unit, so a 2D draw into the composite is not a feedback loop.
 *
 * The 3D view asks for its target's depth as a texture (`ensureDepthStencilTexture`), and Pixi makes the GL texture
 * the first time the target is bound, which leaves it bound on whichever unit was active then, and again on every
 * resize. Pixi unbinds a target's colour textures before it draws into the target and never its depth texture. A 2D
 * batch then samples every unit of its sampler array, including that one, while the same texture is the framebuffer's
 * depth attachment: WebGL refuses the draw ("Feedback loop formed between Framebuffer and active Texture"). Chromium
 * only warns and WebKit fails the draw, so the pixel-art look, which makes the composite the view's target, lost the
 * 2D layers over the view in Safari.
 *
 * Runs as a `draw` hook, so it is before the composite renders: it makes the texture first, if the view has not yet,
 * and unbinds it. Nothing to do on WebGPU (no units) or without a composite (the view draws to the canvas).
 */
export function compositeDepthHooks(stage: PixiStage): PixiStageHooks {
  return {
    draw: () => {
      const composite = stage.composite
      const renderer = stage.app.renderer
      if (composite === undefined || !('gl' in renderer)) return
      const { texture, renderTarget } = renderer as WebGLRenderer
      const target = renderTarget.getRenderTarget(composite.texture)
      target.ensureDepthStencilTexture()
      const depth = target.depthStencilTexture
      if (depth === null) return
      texture.getGlSource(depth.source)
      texture.unbind(depth.source)
    },
  }
}
