import '@automata/editor/tokens.css'
import '@automata/editor/fonts.css'
import '@automata/editor/suite.css'
import type { SuiteEditor } from '@automata/editor/kit/ports'
import {
  browserPublish,
  createLevels2d,
  createSuite,
  createTuner,
  openSuitePorts,
  randomIds,
  samplePorts,
  startSuite,
} from '@automata/editor/suite'
import { browserAudio } from '../../features/audio/audio-output.ts'
import { browserOutputs } from '../../features/feel/feel-stage.ts'
import { contentEditors } from './content-editors.ts'
import { CONTENT_SAMPLE_GAME } from './sample-game.ts'

// The suite page with the content editors: the core editors (the Tuner, Levels 2D), then Feel, Audio, Writer and Sequence. The only
// file that reaches for the page's globals. It opens the checkout it is served on (the game's own content and its Play and
// Publish) or, when none answers, a sample game held in memory, and says so in the top bar (`openSuitePorts`).

const target = document.getElementById('app')
if (target === null) throw new Error('suite.html has no #app element')

openSuitePorts({ origin: location.origin, search: location.search, sessionStorage })
  .then(async (opened) => {
    // With no checkout answering, open the content sample (the core's has none of the content editors' files).
    const { sample, gameUrl, game, publish } = opened
    const ports = sample ? await samplePorts(CONTENT_SAMPLE_GAME) : opened.ports
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
      ...contentEditors({ audio: browserAudio(() => new AudioContext()), outputs: browserOutputs() }),
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
