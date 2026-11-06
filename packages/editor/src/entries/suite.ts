// The editor suite (`@mcthaydt/automata-editor/suite`): the shell and its boot, the editors this package has (Levels 2D, the
// Tuner) and the sample game the page opens when no checkout answers. Another package's suite page adds its own editors.

export {
  createLevels2d,
  type Levels2dOptions,
  type Levels2dSession,
  type Levels2dState,
} from '../app/suite/levels-2d/index'
export { FLOORFIFTY_SAMPLE, samplePorts } from '../features/suite/memory/sample-ports'
export { type SuiteEnv, type SuiteHandle, startSuite } from '../features/suite/shell/boot'
export { createSuite, type Suite } from '../features/suite/shell/create-suite'
export { createTuner, type TunerSuiteSession } from '../features/suite/tuner/tuner-suite-editor'
export { randomIds } from '../shared/level-2d/model/ids'
