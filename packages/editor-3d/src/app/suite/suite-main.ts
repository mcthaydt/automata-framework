// Pixi's WebGL renderer compiles its shaders with eval unless this runs first (the same rule as the 2D suite page).
import '@automata/framework/no-eval'
import '@automata/editor/tokens.css'
import '@automata/editor/fonts.css'
import '@automata/editor/suite.css'
import type { SuiteEditor } from '@automata/editor/kit/ports'
import { createLevels2d, createSuite, createTuner, randomIds, startSuite } from '@automata/editor/suite'
import { createLevels3d } from '../../features/levels-3d/levels-3d-suite-editor.ts'
import { lazyPlanRenderer } from '../../features/levels-3d/plan/lazy-renderer.ts'
import { createStudio } from '../../features/studio/studio-suite-editor.ts'
import { openSuite3d } from './open-suite-3d.ts'

// The full suite's page: the editors of `@automata/editor` plus Levels 3D and the Studio. The only file that
// reaches for the page's globals. When no checkout answers, the page opens a sample game held in memory and says so in
// the top bar. The Studio's stage loads Pixi's 3D view with its first figure, not with the page.

// The Plan view's Pixi renderer, loaded on first use.
const loadPlanRenderer = () => import('../../features/levels-3d/plan/plan-renderer.ts')

const target = document.getElementById('app')
if (target === null) throw new Error('suite.html has no #app element')

openSuite3d({ origin: location.origin, search: location.search, sessionStorage })
  .then(({ ports, sample, gameUrl, game }) => {
    // The Tuner shows the game's dev page beside its settings, so it is made once the server has named it.
    const editors = [
      createTuner({ gameUrl }),
      createLevels2d({ ids: randomIds((bytes) => crypto.getRandomValues(bytes)) }),
      createLevels3d({
        now: () => Date.now(),
        renderer: lazyPlanRenderer(loadPlanRenderer),
        // Walk's eye moves on the page's animation frames.
        frames: {
          request: (callback) => requestAnimationFrame((ms) => callback(ms / 1000)),
          cancel: (handle) => cancelAnimationFrame(handle),
        },
        schedule: (ms, run) => {
          const handle = window.setTimeout(run, ms)
          return () => window.clearTimeout(handle)
        },
      }),
      createStudio({
        stage: async (canvas, size, background) =>
          (await import('../../features/studio/stage/stage-renderer.ts')).createStageRenderer(
            canvas,
            size,
            background,
          ),
        frames: {
          request: (callback) => requestAnimationFrame((ms) => callback(ms / 1000)),
          cancel: (handle) => cancelAnimationFrame(handle),
        },
      }),
    ]
    return startSuite(target, {
      window,
      document,
      ports,
      suite: createSuite({ editors: editors as SuiteEditor<unknown>[] }),
      sample,
      game,
    })
  })
  .catch((error: unknown) => {
    target.textContent = `The editors could not start: ${error instanceof Error ? error.message : String(error)}`
  })
