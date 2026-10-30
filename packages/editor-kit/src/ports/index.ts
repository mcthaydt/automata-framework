// `@mcthaydt/automata-editor-kit/ports` (editor suite spec §4.1, §4.3): the suite editor shape and the ports it is
// given. Headless; the fakes and contract suites are `./ports/testing`.
export {
  type ContributionPoint,
  defineSuiteEditor,
  type SuiteEditor,
  type SuiteRegions,
} from './suite-editor'
export type {
  AskContext,
  AskProvider,
  AskRequest,
  ChangeSet,
  ChangeSetSummary,
  CheckDef,
  CheckFinding,
  CheckMeasure,
  CheckResult,
  CheckRun,
  ChecksRunner,
  GateState,
  Gates,
  Proposal,
  SuitePorts,
  SuiteWorkspace,
  WorkspaceFile,
} from './suite-ports'
