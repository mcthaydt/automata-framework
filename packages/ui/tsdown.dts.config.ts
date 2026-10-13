import { defineConfig } from 'tsdown'

// The second step of `ui`'s published build (M2.4 spec §3.4): svelte-package does not bundle declarations, so
// this inlines `@ruken/sdk`'s types into `dist/vendor/ruken-sdk.d.ts`, which `build/finish-dist.ts` points
// ui's declarations at. Types only: ui imports nothing from Ruken at runtime.
export default defineConfig({
  entry: { 'vendor/ruken-sdk': 'build/ruken-sdk.ts' },
  format: 'esm',
  platform: 'browser',
  target: 'es2022',
  fixedExtension: false,
  clean: false,
  dts: { emitDtsOnly: true, eager: true },
  deps: { onlyBundle: [/^@ruken\/sdk(?:\/|$)/] },
})
