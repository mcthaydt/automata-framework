import type { FolderHandle, HandleVault } from '../storage/folder'

/** A `HandleVault` that keeps handles in a Map, for tests that do not need IndexedDB. */
export function createMemoryVault(): HandleVault & { failNextSave(error: unknown): void } {
  const handles = new Map<string, FolderHandle>()
  let failure: { error: unknown } | undefined
  return {
    async save(name, handle) {
      if (failure !== undefined) {
        const { error } = failure
        failure = undefined
        throw error
      }
      handles.set(name, handle)
    },
    async load(name) {
      return handles.get(name)
    },
    async names() {
      return [...handles.keys()].sort()
    },
    async forget(name) {
      handles.delete(name)
    },
    failNextSave(error) {
      failure = { error }
    },
  }
}
