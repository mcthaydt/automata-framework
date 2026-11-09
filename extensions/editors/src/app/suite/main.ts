// Pixi's WebGL renderer compiles its shaders with eval unless this runs first (Levels 2D, Levels 3D and the Studio draw
// with it).
import '@automata/framework/no-eval'
import '@automata/editor/tokens.css'
import '@automata/editor/fonts.css'
import '@automata/editor/suite.css'
import type { SuiteEditor } from '@automata/editor/kit/ports'
import {
  browserPublish,
  createDownloadStore,
  createLevels2d,
  createSuite,
  createTuner,
  randomIds,
  startSuite,
} from '@automata/editor/suite'
import { editors3d, loadPixi3dFirst } from '@automata/editor-3d/suite'
import { browserAudio } from '../../features/audio/audio-output.ts'
import { browserOutputs } from '../../features/feel/feel-stage.ts'
import { contentEditors } from './content-editors.ts'
import { openContentSuite } from './open-content-suite.ts'

// The page with every editor, which `automata editor` serves every game and the site's try-it page opens: the core
// editors (the Tuner, Levels 2D), Levels 3D and the Studio, then Feel, Audio, Writer, Sequence and Schematic. The rail
// shows every one of them except those for another kind of game (a 2D game has no Levels 3D), whether or not the game
// has their files yet: an editor without files opens on a page that offers to start one. The only file that reaches for
// the page's globals. It opens the game it is served on (its content, its
// Play and its Publish); with no editor server it opens a sample game held in memory and says so in the top bar.

const target = document.getElementById('app')
if (target === null) throw new Error('suite.html has no #app element')

// Pixi 3D loads before anything draws, so a visitor can open the editors in any order (`loadPixi3dFirst` says why).
Promise.all([
  openContentSuite({ origin: location.origin, search: location.search, sessionStorage }),
  loadPixi3dFirst(),
])
  .then(([{ ports, sample, kept, gameUrl, playOff, game, publish }]) => {
    // The Tuner shows the game's dev page beside its settings, so it is made once the server has named it.
    const editors = [
      createTuner({ gameUrl }),
      createLevels2d({
        // The sample has no game folder to keep a level in, so a visitor starts from a template and shares the result.
        templates: sample ? 'content/levels' : undefined,
        share: sample ? createDownloadStore() : undefined,
        ids: randomIds((bytes) => crypto.getRandomValues(bytes)),
        objectUrls: {
          create: (bytes) => URL.createObjectURL(new Blob([bytes as Uint8Array<ArrayBuffer>])),
          revoke: (url) => URL.revokeObjectURL(url),
        },
      }),
      ...editors3d(window),
      ...contentEditors({
        audio: browserAudio(() => new AudioContext()),
        outputs: browserOutputs(),
        gameUrl,
      }),
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
