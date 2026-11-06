import { publishedBuild } from '../../tooling/release/src/tsdown-shared.ts'

// The published build: the ship API and the commands (`index`), the Playwright helpers
// (`e2e`) and the bin. `@ruken/manifest` (compileHeaders, for `automata check --csp`, and the manifest writer
// of `automata ship`) is bundled; Ruken's built CLI is copied whole to `dist/vendor/ruken-cli/`, where `rukenCliPath`
// finds it, and its runtime dependencies are declared. `automata editor` also reads the editor list through the
// editor suite's headless `core`, which Node cannot load from source: it is a devDependency, so the build bundles it,
// and the command runs from a checkout of this repository that built an editor.
export default publishedBuild(import.meta.url, {
  entry: {
    index: 'src/entries/index.ts',
    e2e: 'src/entries/e2e.ts',
    bin: 'src/app/bin.ts',
  },
  platform: 'node',
  bundleRuken: ['@ruken/manifest', '@ruken/cli'],
  copy: [{ from: 'node_modules/@ruken/cli/dist/*', to: 'dist/vendor/ruken-cli' }],
})
