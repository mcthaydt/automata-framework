import type { RenderTarget } from '@mcthaydt/automata-runtime'

/**
 * Watches the canvas for a lost WebGL context (M3 spec §5, "context lost"). While it is lost the renderer draws
 * nothing. When the browser gives the context back, Pixi re-creates its GPU resources and `@pixi/3d`'s meshes upload
 * again on the next draw, so the views and the sim are untouched (renderer.parity.test.ts shows the frame after a
 * restore equals the frame before the loss). Both moments are published on the bus as render facts. Returns
 * whether the context is lost now, and a function that stops watching.
 */
export function watchContextLoss(
  canvas: HTMLCanvasElement,
  bus: RenderTarget['bus'],
): { readonly lost: () => boolean; readonly stop: () => void } {
  let lost = false
  const onLost = (): void => {
    lost = true
    bus?.publish('render.context.lost', {})
  }
  const onBack = (): void => {
    lost = false
    bus?.publish('render.context.restored', {})
  }
  canvas.addEventListener('webglcontextlost', onLost)
  canvas.addEventListener('webglcontextrestored', onBack)
  return {
    lost: () => lost,
    stop: () => {
      canvas.removeEventListener('webglcontextlost', onLost)
      canvas.removeEventListener('webglcontextrestored', onBack)
    },
  }
}
