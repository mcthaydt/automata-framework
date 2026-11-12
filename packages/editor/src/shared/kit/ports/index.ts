// `@automata/editor-kit/ports`: the suite editor shape and the ports it is
// given. Headless; the fakes and contract suites are `./ports/testing`.
export {
  type ContributionPoint,
  defineSuiteEditor,
  type SuiteEditor,
  type SuiteRegions,
  type SuiteUndo,
} from './suite-editor'
export type {
  CheckDef,
  CheckFinding,
  CheckMeasure,
  CheckReport,
  CheckResult,
  CheckRun,
  ChecksRunner,
  EditMode,
  EditorListPort,
  GateState,
  Gates,
  SuitePorts,
  SuiteWorkspace,
  UnlistedFile,
  WorkspaceFile,
} from './suite-ports'
