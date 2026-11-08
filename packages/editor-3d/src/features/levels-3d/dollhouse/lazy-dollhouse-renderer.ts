// The Dollhouse view's renderer, loaded when a 3D view is first shown (ED3D.5e), as the plan's is (`lazy-renderer.ts`):
// Pixi is most of the editor's weight. A module that does not load answers no renderer, so the canvas shows its notice
// and Try again loads again.
import type { DollhouseRendererFactory } from './dollhouse-renderer'

export function lazyDollhouseRenderer(): DollhouseRendererFactory {
  let loading: Promise<typeof import('./dollhouse-renderer')> | undefined
  return async (canvas, size) => {
    loading ??= import('./dollhouse-renderer')
    try {
      return await (await loading).createDollhouseRenderer(canvas, size)
    } catch {
      loading = undefined
      return undefined
    }
  }
}
