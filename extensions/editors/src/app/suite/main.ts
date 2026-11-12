import '@automataframework/editor/tokens.css'
import '@automataframework/editor/tool-chrome.css'
import '@automataframework/editor/fonts.css'
import '@automataframework/editor/suite.css'
import type { SuiteEditor } from '@automataframework/editor/kit/ports'
import {
  browserPublish,
  createLevels2d,
  createSuite,
  createTuner,
  randomIds,
  startSuite,
} from '@automataframework/editor/suite'
import { browserAudio } from '../../features/audio/audio-output.ts'
import { browserOutputs } from '../../features/feel/feel-stage.ts'
import { contentEditors } from './content-editors.ts'
import { openContentSuite } from './open-content-suite.ts'

// The suite page with the content editors: the core editors (the Tuner, Levels 2D), then Feel, Audio, Writer, Sequence and
// Schematic. The only file that reaches for the page's globals. It opens the checkout it is served on (the game's own
// content and its Play and Publish) or, when none answers, a sample game held in memory, and says so in the top bar.

const target = document.getElementById('app')
if (target === null) throw new Error('suite.html has no #app element')

openContentSuite({ origin: location.origin, search: location.search, sessionStorage })
  .then(({ ports, sample, gameUrl, game, publish }) => {
    // The Tuner shows the game's dev page beside its settings, so it is made once the server has named it.
    const editors = [
      createTuner({ gameUrl }),
      createLevels2d({
        ids: randomIds((bytes) => crypto.getRandomValues(bytes)),
        objectUrls: {
          create: (bytes) => URL.createObjectURL(new Blob([bytes as Uint8Array<ArrayBuffer>])),
          revoke: (url) => URL.revokeObjectURL(url),
        },
      }),
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
      game,
      playUrl: gameUrl,
      publish: publish === undefined ? undefined : browserPublish(publish, document),
    })
  })
  .catch((error: unknown) => {
    target.textContent = `The editors could not start: ${error instanceof Error ? error.message : String(error)}`
  })
