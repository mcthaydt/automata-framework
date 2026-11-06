import { publishedBuild } from '../../tooling/release/src/tsdown-shared.ts'

// The published build: the `automata-check-boundaries` bin that game CI runs.
export default publishedBuild(import.meta.url, { entry: { cli: 'src/cli.ts' }, platform: 'node' })
