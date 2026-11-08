// The headless half of the kit's storage (`@mcthaydt/automata-editor/kit/storage`): the rules every ProjectStore shares, for
// a host that writes its own store (the Automata app's, over its own folder). No Svelte and no DOM.
export { createMemoryStore } from '../shared/kit/storage/memory-store'
export {
  classifyStorageError,
  expectationProblem,
  type ProjectStore,
  StorageError,
  type StorageFailure,
  type StoredEntry,
  statPath,
  toBytes,
  type WriteExpectation,
  type WriteResult,
} from '../shared/kit/storage/project-store'
export { assertStorePath, assertStorePrefix, comparePaths } from '../shared/kit/storage/store-path'
