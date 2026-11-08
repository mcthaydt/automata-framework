// Every suite port in memory, wired the way the Node adapters share their journal: what the
// workspace creates goes to the open change set, and `ChangeSet.list()` reads it. A port left
// out is the feature off (no gates), and `changeSet: false` is a suite with no change sets at all.

import type { SuitePorts, UnlistedFile, WorkspaceFile } from '../../../shared/kit/ports/suite-ports'
import type { ProjectStore } from '../../../shared/kit/storage/project-store'
import { createMemoryChangeSet, type MemoryChangeSet, type MemoryChangeSetOptions } from './memory-change-set'
import { createMemoryChecks, type MemoryCheck } from './memory-checks'
import { createMemoryGates, type GateRecords } from './memory-gates'
import { createMemoryWorkspace } from './memory-workspace'

export interface MemoryPortsOptions {
  readonly files?: Readonly<Record<string, string>> | undefined
  readonly classify: (path: string) => WorkspaceFile | UnlistedFile
  readonly generated?: ((path: string) => boolean) | undefined
  readonly store?: ProjectStore | undefined
  readonly checks?: readonly MemoryCheck[] | undefined
  readonly gates?: GateRecords | 'unreadable' | undefined
  readonly changeSet?: MemoryChangeSetOptions | false | undefined
}

export interface MemoryPorts {
  readonly ports: SuitePorts
  /** The change set with its journal's other writers, when there is one. */
  readonly changeSet: MemoryChangeSet | undefined
}

export async function createMemoryPorts(options: MemoryPortsOptions): Promise<MemoryPorts> {
  const changeSet = options.changeSet === false ? undefined : createMemoryChangeSet(options.changeSet)
  const workspace = await createMemoryWorkspace({
    files: options.files,
    classify: options.classify,
    generated: options.generated,
    store: options.store,
    changeSet,
  })
  return {
    ports: {
      workspace,
      changeSet,
      checks: createMemoryChecks(options.checks ?? []),
      gates: options.gates === undefined ? undefined : createMemoryGates(options.gates),
    },
    changeSet,
  }
}
