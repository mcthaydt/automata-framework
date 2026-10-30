import { describe, expect, it, vi } from 'vitest'
import { lazyPlanRenderer } from './lazy-renderer'
import type { PlanRenderer, PlanRendererFactory } from './plan-renderer'

// The page loads Pixi only when a level's plan is first drawn (plan ED3D.5d step 7): the factory loads the renderer's
// module once, and a module that does not load is a plan that cannot draw, not an error the page cannot catch.

const canvas = {} as HTMLCanvasElement
const size = { w: 10, h: 10, resolution: 1 }

describe('lazyPlanRenderer', () => {
  it('loads the module on the first plan and keeps it for the next', async () => {
    const made = {} as PlanRenderer
    const createPlanRenderer = vi.fn<PlanRendererFactory>(async () => made)
    const load = vi.fn(async () => ({ createPlanRenderer }))
    const factory = lazyPlanRenderer(load)
    expect(load).not.toHaveBeenCalled()
    expect(await factory(canvas, size)).toBe(made)
    expect(await factory(canvas, size)).toBe(made)
    expect(load).toHaveBeenCalledOnce()
    expect(createPlanRenderer).toHaveBeenCalledWith(canvas, size)
  })

  it('answers no renderer when the module does not load, and tries the load again next time', async () => {
    const made = {} as PlanRenderer
    const load = vi
      .fn<() => Promise<{ createPlanRenderer: PlanRendererFactory }>>()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue({ createPlanRenderer: async () => made })
    const factory = lazyPlanRenderer(load)
    expect(await factory(canvas, size)).toBeUndefined()
    expect(await factory(canvas, size)).toBe(made)
  })
})
