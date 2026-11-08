import { publishedBuild } from '../../tooling/release/src/tsdown-shared.ts'

// The published build: the ship config type (`index`) and the two bins. `@ruken/manifest` (compileHeaders, for `automata check --csp`, and the manifest writer
// of `automata ship`) is bundled; Ruken's built CLI is copied whole to `dist/vendor/ruken-cli/`, where `rukenCliPath`
// finds it, and its runtime dependencies are declared. `automata editor` also reads the editor list through the
// editor suite's headless `core`, which Node cannot load from source: it is a devDependency, so the build bundles it,
// and the command runs from a checkout of this repository that built an editor.
export default publishedBuild(import.meta.url, {
  entry: {
    index: 'src/entries/index.ts',
    bin: 'src/app/bin.ts',
    // The determinism and layout checker: `automata check` runs it, and a game's CI runs it by name.
    'boundaries-cli': 'src/features/boundaries/cli.ts',
  },
  platform: 'node',
  bundleRuken: ['@ruken/manifest', '@ruken/cli'],
  copy: [{ from: 'node_modules/@ruken/cli/dist/*', to: 'dist/vendor/ruken-cli' }],
})
