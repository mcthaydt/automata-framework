import { publishedBuild } from '../../tooling/release/src/tsdown-shared.ts'

// The published build (M2.4 spec §3.1). Rapier stays an external dependency, loaded lazily (#9).
export default publishedBuild(import.meta.url, {
  entry: { '2d': 'src/2d.ts', '3d': 'src/3d.ts' },
  platform: 'browser',
})
