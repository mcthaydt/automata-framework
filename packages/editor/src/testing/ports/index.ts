// `@mcthaydt/automata-editor-kit/ports/testing` (editor suite spec §12): an in-memory fake of every suite port and the
// contract suite each port's adapters must pass. The fakes pass them here; EDS.1d runs the same suites against the
// Node adapters, so a fake cannot drift from the real thing unnoticed. CI runs the suite on the fakes.
export { type AskScript, describeAskProvider } from './ask-contract'
export { describeChangeSet } from './change-set-contract'
export {
  CHECK_FINDING,
  CHECK_MEASURE,
  CHECKS_SCENARIO,
  type CheckBehaviour,
  describeChecksRunner,
  type ScenarioCheck,
} from './checks-contract'
export { describeGates, GATES_SCENARIO, type GateRecords } from './gates-contract'
export {
  createMemoryChangeSet,
  type MemoryChangeSet,
  type MemoryChangeSetOptions,
} from './memory-change-set'
export { type CheckOutcome, createMemoryChecks, type MemoryCheck } from './memory-checks'
export { createMemoryGates } from './memory-gates'
export { createMemoryPorts, type MemoryPorts, type MemoryPortsOptions } from './memory-ports'
export { createMemoryWorkspace, type MemoryWorkspaceOptions } from './memory-workspace'
export { createScriptedAsk, type ScriptedAsk } from './scripted-ask'
export {
  describeSuiteWorkspace,
  type MakeWorkspace,
  WORKSPACE_SCENARIO,
  type WorkspaceScenario,
} from './workspace-contract'
