// The last step of `pnpm build`: no page of the site may carry Pixi 3D's `./extras` entry. It probes `new Function` at
// load, which the site's policy (no eval) refuses, so a build with it fails here rather than in a visitor's browser.
// Pixi 3D itself is allowed: the free editors on the try-it page include Levels 3D and the Studio, and the launch waits
// for `@pixi/3d` to go public (its closed beta allows no public deployment), so nothing is deployed before then. The
// markers and the walk are the build tools' own (`findPixi3d`), the same scan `automata ship` runs on a game; the site
// depends on the tools, never the other way round.
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { findPixi3d } from '@automata/tools/internal'

/** One message per built file that carries Pixi 3D's extras; an empty list means the build is clean. */
export function scanClosedBeta(root: string): string[] {
  return findPixi3d(root).extras.map(
    ({ file, marker }) =>
      `${file}: carries Pixi 3D extras ("${marker}"), which break under the site's policy`,
  )
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const root = resolve(process.argv[2] ?? 'build')
  const failures = scanClosedBeta(root)
  if (failures.length) throw new Error(failures.join('\n'))
  console.log('No Pixi 3D extras in the build.')
}
