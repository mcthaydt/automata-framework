import { publishedBuild } from '../../tooling/release/src/tsdown-shared.ts'

// The published build (DX.2a, M2.4 spec §3.2): both entries re-export the game package and the sim, which stay
// external as dependencies.
export default publishedBuild(import.meta.url, {
  entry: { index: 'src/index.ts', 'no-eval': 'src/no-eval.ts' },
  platform: 'browser',
})
