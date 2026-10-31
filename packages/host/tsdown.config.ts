import { publishedBuild } from '../../tooling/release/src/tsdown-shared.ts'

// The published build (M2.4 spec §3.4): `.` inlines the Ruken SDK's `SdkEnv` type (`HostingSeams`, until DIST.4),
// `./target-ruken` bundles `@ruken/sdk`, and `./testing` also bundles `@ruken/sdk-host`
// (whose own dependency, zod, is declared in package.json). `./target` has one file per adapter (DIST spec §5.3):
// `target-ruken` (`automata-ruken`) and `target-web` (`automata-web` and `default`, no SDK code).
export default publishedBuild(import.meta.url, {
  entry: {
    index: 'src/index.ts',
    'target-ruken': 'src/ruken/target.ts',
    'target-web': 'src/web/target.ts',
    testing: 'src/testing/index.ts',
  },
  platform: 'browser',
  bundleRuken: ['@ruken/sdk', '@ruken/sdk-host'],
})
