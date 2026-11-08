import { publishedBuild } from '../../tooling/release/src/tsdown-shared.ts'

// The published build: one bundle per entry; dependencies and peers stay external.
export default publishedBuild(import.meta.url, {
  entry: {
    index: './src/entries/index.ts',
    stage: './src/entries/stage.ts',
  },
  platform: 'browser',
})
