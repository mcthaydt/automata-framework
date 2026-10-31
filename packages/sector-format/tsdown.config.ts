import { publishedBuild } from '../../tooling/release/src/tsdown-shared.ts'

// FR.1 (Plus TR-D3): the private sector format builds to `dist` like the published packages, so the pack Plus installs exports built
// code and a binary that runs from built code can load it. It stays private (nothing publishes it). Zod only, so it runs anywhere:
// the browser (the editor) and Node (the blockout pipeline).
export default publishedBuild(import.meta.url, {
  entry: {
    index: 'src/index.ts',
    blockout: 'blockout/index.ts',
  },
  platform: 'browser',
})
