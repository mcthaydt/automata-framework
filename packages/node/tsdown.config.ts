import { publishedBuild } from '../../tooling/release/src/tsdown-shared.ts'

// The published build (M2.4 spec §3.1).
export default publishedBuild(import.meta.url, { entry: { index: 'src/index.ts' }, platform: 'node' })
