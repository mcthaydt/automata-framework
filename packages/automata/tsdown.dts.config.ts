import { defineConfig } from 'tsdown'

// The second pass of runtime's published build: the declarations of the
// vendored Ruken packages runtime imports types from, inlined into `dist/vendor/`, which `build/finish-dist.ts`
// points runtime's declarations at. Types only: runtime imports nothing from Ruken at runtime.
export default defineConfig({
  entry: { 'vendor/ruken-sdk-host-testing': 'build/ruken/ruken-sdk-host-testing.ts' },
  format: 'esm',
  platform: 'browser',
  target: 'es2022',
  fixedExtension: false,
  clean: false,
  dts: { emitDtsOnly: true, eager: true },
  deps: { onlyBundle: [/^@ruken\/sdk-host(?:\/|$)/] },
})
