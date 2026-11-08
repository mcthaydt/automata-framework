// Every suite port in memory. What the workspace creates it remembers, so `remove` takes back only what this session
// made; a port left out is the feature off (no gates).

import type { SuitePorts, UnlistedFile, WorkspaceFile } from '../../../shared/kit/ports/suite-ports'
import type { ProjectStore } from '../../../shared/kit/storage/project-store'
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
}

export interface MemoryPorts {
  readonly ports: SuitePorts
}

export async function createMemoryPorts(options: MemoryPortsOptions): Promise<MemoryPorts> {
  const workspace = await createMemoryWorkspace({
    files: options.files,
    classify: options.classify,
    generated: options.generated,
    store: options.store,
  })
  return {
    ports: {
      workspace,
      checks: createMemoryChecks(options.checks ?? []),
      gates: options.gates === undefined ? undefined : createMemoryGates(options.gates),
    },
  }
}
