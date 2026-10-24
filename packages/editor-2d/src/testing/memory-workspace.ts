import {
  createDownloadStore,
  createMemoryStore,
  type StorageClock,
  type Workspace,
} from '@mcthaydt/automata-editor-kit/core'

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
