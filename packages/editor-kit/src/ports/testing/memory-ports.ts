// Every suite port in memory, wired the way the Node adapters share their journal (editor suite spec §4.5): what the
// workspace creates and what the Ask spends go to the open change set, which `ChangeSet.list()` reads. A port left
// out is the feature off (no gates, no Ask), and `changeSet: false` is a suite with no change sets at all.
import type { ProjectStore } from '../../storage/project-store'
import type { AskRequest, Proposal, SuitePorts, WorkspaceFile } from '../suite-ports'
import type { GateRecords } from './gates-contract'
import { createMemoryChangeSet, type MemoryChangeSet, type MemoryChangeSetOptions } from './memory-change-set'
import { createMemoryChecks, type MemoryCheck } from './memory-checks'
import { createMemoryGates } from './memory-gates'
import { createMemoryWorkspace } from './memory-workspace'
import { createScriptedAsk, type ScriptedAsk } from './scripted-ask'

export interface MemoryPortsOptions {
  readonly files?: Readonly<Record<string, string>> | undefined
  readonly rows: readonly WorkspaceFile[]
  readonly generated?: readonly string[] | undefined
  readonly store?: ProjectStore | undefined
  readonly checks?: readonly MemoryCheck[] | undefined
  readonly gates?: GateRecords | 'unreadable' | undefined
  readonly ask?: ((request: AskRequest) => Promise<Proposal> | Proposal) | undefined
  readonly changeSet?: MemoryChangeSetOptions | false | undefined
}

export interface MemoryPorts {
  readonly ports: SuitePorts
  /** The change set with its journal's other writers, when there is one. */
  readonly changeSet: MemoryChangeSet | undefined
  /** The scripted assistant and the requests it was given, when there is one. */
  readonly ask: ScriptedAsk | undefined
}

export async function createMemoryPorts(options: MemoryPortsOptions): Promise<MemoryPorts> {
  const changeSet = options.changeSet === false ? undefined : createMemoryChangeSet(options.changeSet)
  const workspace = await createMemoryWorkspace({
    files: options.files,
    rows: options.rows,
    generated: options.generated,
    store: options.store,
    changeSet,
  })
  const ask =
    options.ask === undefined
      ? undefined
      : createScriptedAsk(options.ask, { onTokens: (tokens) => changeSet?.noteTokens(tokens) })
  return {
    ports: {
      workspace,
      changeSet,
      checks: createMemoryChecks(options.checks ?? []),
      gates: options.gates === undefined ? undefined : createMemoryGates(options.gates),
      ask: ask?.provider,
    },
    changeSet,
    ask,
  }
}
