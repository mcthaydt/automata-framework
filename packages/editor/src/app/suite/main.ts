import '../../shared/kit/tokens.css'
import '../../shared/kit/fonts.css'
import './main.css'
import { startSuite } from '../../features/suite/shell/boot.ts'
import { createSuite } from '../../features/suite/shell/create-suite.ts'
import { SAMPLE_GAME, samplePorts } from '../../features/suite/shell/sample-ports.ts'
import { createTuner } from '../../features/suite/tuner/tuner-suite-editor.ts'
import type { SuiteEditor } from '../../shared/kit/ports/suite-editor.ts'
import { randomIds } from '../../shared/level-2d/model/ids.ts'
import { createLevels2d } from './levels-2d/levels-2d-suite-editor.ts'

// The suite's page for this package: the editors it has (the Tuner and Levels 2D) and nothing from 3D, so its build
// carries no `@pixi/3d`. The only file that reaches for the page's globals. When no checkout answers, the page opens a
// sample game held in memory and says so in the top bar. `editor-3d`'s own suite page adds the 3D editors.

const target = document.getElementById('app')
if (target === null) throw new Error('suite.html has no #app element')

const editors = [createTuner(), createLevels2d({ ids: randomIds((bytes) => crypto.getRandomValues(bytes)) })]

samplePorts(SAMPLE_GAME)
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
