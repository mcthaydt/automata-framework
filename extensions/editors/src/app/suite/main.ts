import '@automata/editor/tokens.css'
import '@automata/editor/fonts.css'
import '@automata/editor/suite.css'
import type { SuiteEditor } from '@automata/editor/kit/ports'
import {
  createLevels2d,
  createSuite,
  createTuner,
  randomIds,
  samplePorts,
  startSuite,
} from '@automata/editor/suite'
import { contentEditors } from './content-editors.ts'
import { CONTENT_SAMPLE_GAME } from './sample-game.ts'

// The suite page with the content editors: the core editors (the Tuner, Levels 2D), then Feel and the rest. The only
// file that reaches for the page's globals. It opens a sample game held in memory and says so in the top bar.

const target = document.getElementById('app')
if (target === null) throw new Error('suite.html has no #app element')

const editors = [
  createTuner(),
  createLevels2d({ ids: randomIds((bytes) => crypto.getRandomValues(bytes)) }),
  ...contentEditors(),
]

samplePorts(CONTENT_SAMPLE_GAME)
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
