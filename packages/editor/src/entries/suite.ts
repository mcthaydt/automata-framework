// The editor suite (`@mcthaydt/automata-editor/suite`): the shell and its boot, the editors this package has (Levels 2D, the
// Tuner) and the sample game the page opens when no checkout answers. Another package's suite page adds its own editors.

export {
  createLevels2d,
  type Levels2dOptions,
  type Levels2dSession,
  type Levels2dState,
} from '../app/suite/levels-2d/index'
export { type SuiteEnv, type SuiteHandle, startSuite } from '../features/suite/shell/boot'
export { createSuite, type Suite } from '../features/suite/shell/create-suite'
export { SAMPLE_GAME, samplePorts } from '../features/suite/shell/sample-ports'
export { createTuner, type TunerSuiteSession } from '../features/suite/tuner/tuner-suite-editor'
export { randomIds } from '../shared/level-2d/model/ids'
