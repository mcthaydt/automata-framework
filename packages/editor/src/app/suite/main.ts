// Pixi's WebGL renderer compiles its shaders with eval unless this runs first, and a page with a strict CSP (the
// site's try-it editor) allows none: without it the level canvas says "Preview unavailable".
import '@automata/framework/no-eval'
import '../../shared/kit/tokens.css'
import '../../shared/kit/tool-chrome.css'
import '../../shared/kit/fonts.css'
import './main.css'
import { startSuite } from '../../features/suite/shell/boot.ts'
import { createSuite } from '../../features/suite/shell/create-suite.ts'
import { openSuitePorts } from '../../features/suite/shell/open-suite-ports.ts'
import { createTuner } from '../../features/suite/tuner/tuner-suite-editor.ts'
import type { SuiteEditor } from '../../shared/kit/ports/suite-editor.ts'
import { createDownloadStore } from '../../shared/kit/storage/download-store.ts'
import { randomIds } from '../../shared/level-2d/model/ids.ts'
import { createLevels2d } from './levels-2d/levels-2d-suite-editor.ts'

// The suite's page for this package: the editors it has (the Tuner and Levels 2D) and nothing from 3D, so its build
// carries no `@pixi/3d` (`-tools`' build scans it for the beta). Only these two: the other suite editors are 3D (Levels
// 3D and the Studio, which `editor-3d`'s own suite page adds) or not built yet. The rail lists what is registered here.
// The only file that reaches for the page's globals. It opens the checkout it is served on or, when none answers, a
// sample game held in memory, and says so in the top bar (`open-suite-ports.ts`).

const target = document.getElementById('app')
if (target === null) throw new Error('suite.html has no #app element')

openSuitePorts({ origin: location.origin, search: location.search, sessionStorage })
  .then(({ ports, sample, gameUrl, game }) => {
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
