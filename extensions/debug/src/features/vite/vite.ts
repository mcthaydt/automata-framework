// `@automata/debug/vite`: the build constant that gates debug. A game's config passes `true` in dev and
// in a `--debug` build, `false` in a release build. Debug code is reached only behind `__AUTOMATA_DEBUG__`, so a release bundle
// tree-shakes the overlay and the driver; the bundle test fails if it does not.
import type { Plugin } from 'vite'

/**
 * A Vite plugin that sets `__AUTOMATA_DEBUG__`. Pass `true` in dev and `--debug` builds and
 * `false` in a release build, so a release bundle leaves the overlay out.
 */
export function debugBuild(debug: boolean): Plugin {
  return {
    name: 'automata-debug-build',
    config: () => ({ define: { __AUTOMATA_DEBUG__: JSON.stringify(debug) } }),
  }
}
