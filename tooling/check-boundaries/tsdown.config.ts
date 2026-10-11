import { publishedBuild } from '../../tooling/release/src/tsdown-shared.ts'

// The published build (M2.4 spec §3.1): the `automata-check-boundaries` bin that game CI runs.
export default publishedBuild(import.meta.url, { entry: { cli: 'src/cli.ts' }, platform: 'node' })
