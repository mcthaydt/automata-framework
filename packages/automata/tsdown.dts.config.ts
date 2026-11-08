import { defineConfig } from 'tsdown'

// The second pass of the published build: the declarations of the vendored Ruken packages this package imports types
// from, inlined into `dist/vendor/`, which `build/finish-dist.ts` points the declarations at. Types only: the code that
// needs a Ruken package at run time is bundled by `tsdown.config.ts`.
export default defineConfig({
  entry: {
    'vendor/ruken-sdk': 'build/ruken/ruken-sdk.ts',
    'vendor/ruken-sdk-host-testing': 'build/ruken/ruken-sdk-host-testing.ts',
  },
  format: 'esm',
  platform: 'browser',
  target: 'es2022',
  fixedExtension: false,
  clean: false,
  dts: { emitDtsOnly: true, eager: true },
  deps: { onlyBundle: [/^@ruken\/sdk(?:-host)?(?:\/|$)/] },
})
