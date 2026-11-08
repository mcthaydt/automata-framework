import '@automata/editor/tokens.css'
import '@automata/editor/fonts.css'
import '@automata/editor/suite.css'
import type { SuiteEditor } from '@automata/editor/kit/ports'
import {
  createLevels2d,
  createSuite,
  createTuner,
  randomIds,
  SAMPLE_GAME,
  samplePorts,
  startSuite,
} from '@automata/editor/suite'
import { createStudio } from '../../features/studio/studio-suite-editor.ts'
import { createLevels3d, lazyPlanRenderer, loadPlanRenderer } from './index.ts'

// The full suite's page: the editors of `@automata/editor` plus Levels 3D and the Studio. The only file that
// reaches for the page's globals. When no checkout answers, the page opens a sample game held in memory and says so in
// the top bar. The Studio's stage loads Pixi's 3D view with its first figure, not with the page.

const target = document.getElementById('app')
if (target === null) throw new Error('suite.html has no #app element')

const editors = [
  createTuner(),
  createLevels2d({ ids: randomIds((bytes) => crypto.getRandomValues(bytes)) }),
  createLevels3d({
    now: () => Date.now(),
    renderer: lazyPlanRenderer(loadPlanRenderer),
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

samplePorts(SAMPLE_GAME)
  .then((ports) =>
    startSuite(target, {
      window,
      document,
      ports,
      suite: createSuite({ editors: editors as SuiteEditor<unknown>[] }),
      sample: true,
    }),
  )
  .catch((error: unknown) => {
    target.textContent = `The editors could not start: ${error instanceof Error ? error.message : String(error)}`
  })
