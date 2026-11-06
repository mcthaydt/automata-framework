import type { StorageClock } from '../../shared/kit/storage/clock.ts'
import { createDownloadStore } from '../../shared/kit/storage/download-store.ts'
import { createMemoryStore } from '../../shared/kit/storage/memory-store.ts'
import type { Workspace } from '../../shared/kit/storage/workspace.ts'

/** A workspace in memory, as `openWorkspace` gives when OPFS cannot be used, but reporting itself persistent so the status line behaves as it does with OPFS. */
export function memoryWorkspace(clock: StorageClock): Workspace {
  return {
    store: createMemoryStore({ now: clock.now }),
    journal: createMemoryStore({ now: clock.now }),
    exports: createDownloadStore({ now: clock.now, download: () => {} }),
    persistent: true,
    reason: undefined,
  }
}

export const textOf = (bytes: Uint8Array | undefined): string | undefined =>
  bytes === undefined ? undefined : new TextDecoder().decode(bytes)
