import { publishedBuild } from '../../tooling/release/src/tsdown-shared.ts'

// `@ruken/manifest` (compileHeaders, for the `automata check --csp` step) is bundled, as in ship. `automata editor` also
// reads the editor list through the editor suite's headless `core`, which Node cannot load from source: it is a
// devDependency, so the build bundles it, and the command runs from a checkout of this repository that built an editor.
export default publishedBuild(import.meta.url, {
  entry: { index: 'src/index.ts', bin: 'src/bin.ts' },
  platform: 'node',
  bundleRuken: ['@ruken/manifest'],
})
