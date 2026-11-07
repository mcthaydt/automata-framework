import { publishedBuild } from '../../tooling/release/src/tsdown-shared.ts'

// The published build. Rapier stays an external dependency, loaded lazily so a game that never steps physics never
// downloads it.
export default publishedBuild(import.meta.url, {
  entry: { '2d': 'src/entries/2d.ts', '3d': 'src/entries/3d.ts' },
  platform: 'browser',
})
