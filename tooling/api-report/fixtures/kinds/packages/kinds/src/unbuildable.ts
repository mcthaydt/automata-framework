// Re-exports only the API report reads: the alias resolves to nothing, so it is named by its module. tsdown
// cannot build them, so the emitted fixture in tooling/api-index has no such entry.

export { ghost } from './missing.ts'
export { default as Widget } from './widget.svelte'
