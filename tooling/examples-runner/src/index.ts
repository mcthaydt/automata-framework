// The examples runner's public entry: the catalog of examples and their headers, the parity goldens' type and the
// Vite plugin that serves the examples index. Only re-exports; each module says what it does.
export { type CatalogEntry, type CatalogOptions, readCatalog } from './catalog.ts'
export { type Header, type HeaderError, parseHeader } from './header.ts'
export type { GoldenExample } from './parity.ts'
export { type ExamplesRunnerOptions, examplesRunner } from './vite-plugin.ts'
