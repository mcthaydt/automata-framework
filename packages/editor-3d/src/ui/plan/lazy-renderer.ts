// The Plan view's renderer, loaded when a level's plan is first drawn (ED3D.5d): Pixi is most of the editor's weight, and
// Home needs none of it. `main.ts` hands in a dynamic `import()` of `plan-renderer.ts`. A module that does not load
// (the page went offline after it opened) answers no renderer, so the canvas shows its notice and Try again loads again.
import type { PlanRendererFactory } from './plan-renderer'

export function lazyPlanRenderer(
  load: () => Promise<{ readonly createPlanRenderer: PlanRendererFactory }>,
): PlanRendererFactory {
  let loading: Promise<{ readonly createPlanRenderer: PlanRendererFactory }> | undefined
  return async (canvas, size) => {
    loading ??= load()
    try {
      const module = await loading
      return await module.createPlanRenderer(canvas, size)
    } catch {
      loading = undefined
      return undefined
    }
  }
}
