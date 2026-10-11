import { publishedBuild } from '../../tooling/release/src/tsdown-shared.ts'

// The published build (M2.4 spec §3.2). koota and zod stay external.
export default publishedBuild(import.meta.url, {
  entry: { index: 'src/index.ts', hash: 'src/hash/hash.ts', math: 'src/math/dmath.ts' },
  platform: 'browser',
})
