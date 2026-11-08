import '../../shared/kit/tokens.css'
import '../../shared/kit/fonts.css'
import './main.css'
import { startSuite } from '../../features/suite/shell/boot.ts'
import { createSuite } from '../../features/suite/shell/create-suite.ts'
import { openSuitePorts } from '../../features/suite/shell/open-suite-ports.ts'
import { createTuner } from '../../features/suite/tuner/tuner-suite-editor.ts'
import type { SuiteEditor } from '../../shared/kit/ports/suite-editor.ts'
import { randomIds } from '../../shared/level-2d/model/ids.ts'
import { createLevels2d } from './levels-2d/levels-2d-suite-editor.ts'

// The suite's page for this package: the editors it has (the Tuner and Levels 2D) and nothing from 3D, so its build
// carries no `@pixi/3d` (`-tools`' build scans it for the beta). Only these two: the other suite editors are 3D (Levels
// 3D and the Studio, which `editor-3d`'s own suite page adds) or not built yet. The rail lists what is registered here.
// The only file that reaches for the page's globals. It opens the checkout it is served on or, when none answers, a
// sample game held in memory, and says so in the top bar (`open-suite-ports.ts`).

const target = document.getElementById('app')
if (target === null) throw new Error('suite.html has no #app element')

const editors = [createTuner(), createLevels2d({ ids: randomIds((bytes) => crypto.getRandomValues(bytes)) })]

openSuitePorts({ origin: location.origin, search: location.search, sessionStorage })
  .then(({ ports, sample }) =>
    startSuite(target, {
      window,
      document,
      ports,
      suite: createSuite({ editors: editors as SuiteEditor<unknown>[] }),
      sample,
    }),
  )
  .catch((error: unknown) => {
    target.textContent = `The editors could not start: ${error instanceof Error ? error.message : String(error)}`
  })
