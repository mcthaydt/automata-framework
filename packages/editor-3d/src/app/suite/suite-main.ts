// Pixi's WebGL renderer compiles its shaders with eval unless this runs first (the same rule as the 2D suite page).
import '@automata/framework/no-eval'
import '@automata/editor/tokens.css'
import '@automata/editor/fonts.css'
import '@automata/editor/suite.css'
import type { SuiteEditor } from '@automata/editor/kit/ports'
import {
  browserPublish,
  createLevels2d,
  createSuite,
  createTuner,
  randomIds,
  startSuite,
} from '@automata/editor/suite'
import { editors3d } from './editors-3d.ts'
import { openSuite3d } from './open-suite-3d.ts'
import { loadPixi3dFirst } from './pixi-3d-first.ts'

// This package's suite page: the editors of `@automata/editor` plus Levels 3D and the Studio, with the game's Play and
// Publish. The only file that reaches for the page's globals. When no checkout answers, the page opens a sample game
// held in memory and says so in the top bar. The page `automata editor` serves a 3D game is `@automata/editors`' suite,
// which adds the content editors to these.

const target = document.getElementById('app')
if (target === null) throw new Error('suite.html has no #app element')

// Pixi 3D loads before anything draws, so the editors open in any order (`loadPixi3dFirst` says why).
Promise.all([
  openSuite3d({ origin: location.origin, search: location.search, sessionStorage }),
  loadPixi3dFirst(),
])
  .then(([{ ports, sample, kept, gameUrl, playOff, game, publish }]) => {
    // The Tuner shows the game's dev page beside its settings, so it is made once the server has named it.
    const editors = [
      createTuner({ gameUrl }),
      createLevels2d({ ids: randomIds((bytes) => crypto.getRandomValues(bytes)) }),
      ...editors3d(window),
    ]
    return startSuite(target, {
      window,
      document,
      ports,
      suite: createSuite({ editors: editors as SuiteEditor<unknown>[] }),
      sample,
      kept,
      game,
      playUrl: gameUrl,
      playOff,
      publish: publish === undefined ? undefined : browserPublish(publish, document),
    })
  })
  .catch((error: unknown) => {
    target.textContent = `The editors could not start: ${error instanceof Error ? error.message : String(error)}`
  })
