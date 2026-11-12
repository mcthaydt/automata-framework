// Levels 3D and the Studio as a suite page makes them: one place, so this package's own page and the page with every
// editor (`@automata/editors`' suite) build them alike. Each loads its Pixi renderer on first use, not with the page.
import type { SuiteEditor } from '@automata/editor/kit/ports'
import { createLevels3d } from '../../features/levels-3d/levels-3d-suite-editor.ts'
import { lazyPlanRenderer } from '../../features/levels-3d/plan/lazy-renderer.ts'
import { createStudio } from '../../features/studio/studio-suite-editor.ts'

/** The page's own clocks: animation frames and timers. */
export interface PageClocks {
  readonly requestAnimationFrame: (callback: (ms: number) => void) => number
  readonly cancelAnimationFrame: (handle: number) => void
  readonly setTimeout: (run: () => void, ms: number) => number
  readonly clearTimeout: (handle: number) => void
}

export function editors3d(page: PageClocks): SuiteEditor<unknown>[] {
  const frames = {
    request: (callback: (seconds: number) => void) => page.requestAnimationFrame((ms) => callback(ms / 1000)),
    cancel: (handle: number) => page.cancelAnimationFrame(handle),
  }
  return [
    createLevels3d({
      now: () => Date.now(),
      renderer: lazyPlanRenderer(() => import('../../features/levels-3d/plan/plan-renderer.ts')),
      // Walk's eye moves on the page's animation frames.
      frames,
      schedule: (ms, run) => {
        const handle = page.setTimeout(run, ms)
        return () => page.clearTimeout(handle)
      },
    }),
    createStudio({
      stage: async (canvas, size, background) =>
        (await import('../../features/studio/stage/stage-renderer.ts')).createStageRenderer(
          canvas,
          size,
          background,
        ),
      frames,
    }),
  ] as SuiteEditor<unknown>[]
}
