import '@mcthaydt/automata-editor-kit/tokens.css'
import '@mcthaydt/automata-editor-kit/fonts.css'
import './main.css'
import { createLevels2d, randomIds } from '@mcthaydt/automata-editor-2d/suite'
import { createLevels3d, lazyPlanRenderer, loadPlanRenderer } from '@mcthaydt/automata-editor-3d/suite'
import type { SuiteEditor } from '@mcthaydt/automata-editor-kit/ports'
import { startSuite } from './shell/boot'
import { createSuite } from './shell/create-suite'
import { FLOORFIFTY_SAMPLE, samplePorts } from './testing/sample-ports'

// The only file that reaches for the page's globals. Until `automata editor` serves a game's checkout (EDS.1d), the
// page opens a sample game held in memory, and says so in the top bar. The free build registers the level editors
// (EDS.2d); the Tuner (EDS.4a) adds its own here.

const target = document.getElementById('app')
if (target === null) throw new Error('index.html has no #app element')

const editors = [
  createLevels2d({ ids: randomIds((bytes) => crypto.getRandomValues(bytes)) }),
  createLevels3d({
    now: () => Date.now(),
    renderer: lazyPlanRenderer(loadPlanRenderer),
    schedule: (ms, run) => {
      const handle = window.setTimeout(run, ms)
      return () => window.clearTimeout(handle)
    },
  }),
]

samplePorts(FLOORFIFTY_SAMPLE)
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
