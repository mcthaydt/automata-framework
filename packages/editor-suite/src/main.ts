import '@mcthaydt/automata-editor-kit/tokens.css'
import '@mcthaydt/automata-editor-kit/fonts.css'
import './main.css'
import { startSuite } from './shell/boot'
import { createSuite } from './shell/create-suite'
import { FLOORFIFTY_SAMPLE, samplePorts } from './testing/sample-ports'

// The only file that reaches for the page's globals. Until `automata editor` serves a game's checkout (EDS.1d), the
// page opens a sample game held in memory, and says so in the top bar. The free build has no editors registered yet:
// the Tuner (EDS.4a) and the level editors (EDS.2d) add theirs here.

const target = document.getElementById('app')
if (target === null) throw new Error('index.html has no #app element')

samplePorts(FLOORFIFTY_SAMPLE)
  .then((ports) =>
    startSuite(target, { window, document, ports, suite: createSuite({ editors: [] }), sample: true }),
  )
  .catch((error: unknown) => {
    target.textContent = `The editors could not start: ${error instanceof Error ? error.message : String(error)}`
  })
