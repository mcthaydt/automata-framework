import '@mcthaydt/automata-editor-kit/tokens.css'
import '@mcthaydt/automata-editor-kit/fonts.css'
import './main.css'
import { createLevels2d, randomIds } from '@mcthaydt/automata-editor-2d/suite'
import { createLevels3d, lazyPlanRenderer, loadPlanRenderer } from '@mcthaydt/automata-editor-3d/suite'
import { openServedWorkspace } from '@mcthaydt/automata-editor-kit/core'
import type { SuiteEditor } from '@mcthaydt/automata-editor-kit/ports'
import { createStudio } from './editors/studio/studio-suite-editor'
import { createTuner } from './editors/tuner/tuner-suite-editor'
import { startSuite } from './shell/boot'
import { createSuite } from './shell/create-suite'
import { servedPorts } from './shell/served-ports'
import { SAMPLE_GAME, samplePorts } from './testing/sample-ports'

// The only file that reaches for the page's globals. Served by `automata editor`, the page edits that game's checkout
// through the server (its token comes in the address); opened any other way it shows a sample game held in memory, and
// says so in the top bar. The free build registers the level editors (EDS.2d), the Tuner (EDS.4a) and the Studio (EDS.9).

const target = document.getElementById('app')
if (target === null) throw new Error('index.html has no #app element')

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
  // The Studio's stage loads Pixi's 3D view with its first figure, not with the page.
  createStudio({
    stage: async (canvas, size, background) =>
      (await import('./editors/studio/stage/stage-renderer')).createStageRenderer(canvas, size, background),
    frames: {
      request: (callback) => requestAnimationFrame((ms) => callback(ms / 1000)),
      cancel: (handle) => cancelAnimationFrame(handle),
    },
  }),
]

openServedWorkspace({
  origin: window.location.origin,
  search: window.location.search,
  sessionStorage: window.sessionStorage,
})
  .catch(() => undefined)
  .then(async (served) =>
    startSuite(target, {
      window,
      document,
      ports: served === undefined ? await samplePorts(SAMPLE_GAME) : await servedPorts(served.store),
      suite: createSuite({ editors: editors as SuiteEditor<unknown>[] }),
      sample: served === undefined,
    }),
  )
  .catch((error: unknown) => {
    target.textContent = `The editors could not start: ${error instanceof Error ? error.message : String(error)}`
  })
