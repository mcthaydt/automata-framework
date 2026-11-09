// `@automata/editor-kit/ports/testing`: an in-memory fake of every suite port and the
// contract suite each port's adapters must pass. The fakes pass them here; the Node adapters run the same suites, so a fake cannot drift from the real thing unnoticed. CI runs the suite on the fakes.

export {
  createMemoryChangeSet,
  type MemoryChangeSet,
  type MemoryChangeSetOptions,
} from '../../shared/kit/ports/memory/memory-change-set'
export {
  type CheckOutcome,
  createMemoryChecks,
  type MemoryCheck,
} from '../../shared/kit/ports/memory/memory-checks'
export { createMemoryGates } from '../../shared/kit/ports/memory/memory-gates'
export {
  createMemoryPorts,
  type MemoryPorts,
  type MemoryPortsOptions,
} from '../../shared/kit/ports/memory/memory-ports'
export {
  createMemoryWorkspace,
  type MemoryWorkspaceOptions,
} from '../../shared/kit/ports/memory/memory-workspace'
export { createScriptedAsk, type ScriptedAsk } from '../../shared/kit/ports/memory/scripted-ask'
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
  describeSuiteWorkspace,
  type MakeWorkspace,
  WORKSPACE_SCENARIO,
  type WorkspaceScenario,
} from './workspace-contract'
