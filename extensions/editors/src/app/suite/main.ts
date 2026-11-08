import '@automata/editor/tokens.css'
import '@automata/editor/fonts.css'
import '@automata/editor/suite.css'
import type { SuiteEditor } from '@automata/editor/kit/ports'
import { createLevels2d, createSuite, createTuner, randomIds, startSuite } from '@automata/editor/suite'
import { contentEditors } from './content-editors.ts'
import { openContentSuite } from './open-content-suite.ts'

// The suite page with the content editors: the core editors (the Tuner, Levels 2D), then Feel and the rest. The only
// file that reaches for the page's globals. It opens the game it is served on; with no editor server it opens a sample
// game held in memory and says so in the top bar.

const target = document.getElementById('app')
if (target === null) throw new Error('suite.html has no #app element')

openContentSuite({ origin: location.origin, search: location.search, sessionStorage })
  .then(({ ports, sample, gameUrl, game }) => {
    // The Tuner shows the game's dev page beside its settings, so it is made once the server has named it.
    const editors = [
      createTuner({ gameUrl }),
      createLevels2d({ ids: randomIds((bytes) => crypto.getRandomValues(bytes)) }),
      ...contentEditors(),
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
