import { publishedBuild } from '../../tooling/release/src/tsdown-shared.ts'

// The published build. koota and zod stay external. `./replay` is the replay codec entry; `./testing`,
// `./testing/commands` and `./testing/property` are the golden and replay helpers (they import the optional peer
// `vitest`, so it is declared in package.json).
export default publishedBuild(import.meta.url, {
  entry: {
    index: 'src/entries/index.ts',
    hash: 'src/entries/hash.ts',
    math: 'src/entries/math.ts',
    replay: 'src/entries/replay.ts',
    testing: 'src/entries/testing.ts',
    'testing-commands': 'src/entries/testing-commands.ts',
    'testing-property': 'src/entries/testing-property.ts',
  },
  platform: 'browser',
})
