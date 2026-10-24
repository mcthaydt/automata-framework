import { publishedBuild } from '../../tooling/release/src/tsdown-shared.ts'

// The published build (M2.4 spec §3.4): `.` bundles `@ruken/sdk`, `./testing` also bundles `@ruken/sdk-host`
// (whose own dependency, zod, is declared in package.json). `./target` has one file per export condition
// (PUB spec §3): `target` (default, the Ruken adapter) and `target-web` (`automata-web`, no SDK code).
export default publishedBuild(import.meta.url, {
  entry: {
    index: 'src/index.ts',
    target: 'src/target-ruken.ts',
    'target-web': 'src/target-web.ts',
    testing: 'src/testing/index.ts',
  },
  platform: 'browser',
  bundleRuken: ['@ruken/sdk', '@ruken/sdk-host'],
})
