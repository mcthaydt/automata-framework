import { publishedBuild } from '../../tooling/release/src/tsdown-shared.ts'

export default publishedBuild(import.meta.url, {
  entry: { index: 'src/index.ts', bin: 'src/bin.ts' },
  platform: 'node',
})
