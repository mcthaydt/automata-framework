// The last step of `pnpm build`: no page of the site may carry Pixi 3D's extras. `@pixi/3d` itself is public (npmjs.org,
// MIT) and a page may draw with it, but its `./extras` entry probes `new Function` when it loads, and the site's CSP
// allows no eval (QB.4), so a build with it fails here rather than in a visitor's browser. The markers and the walk
// are the build tools' own (`findPixi3d`), the same scan `automata ship` runs on a game; the site depends on the
// tools, never the other way round.
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { findPixi3d } from '@automata/tools/internal'

/** One message per built file that carries Pixi 3D's extras; an empty list means the build is clean. */
export function scanPixi3dExtras(root: string): string[] {
  return findPixi3d(root).extras.map(
    ({ file, marker }) =>
      `${file}: carries Pixi 3D's extras ("${marker}"), which need eval; the site's CSP refuses it`,
  )
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const root = resolve(process.argv[2] ?? 'build')
  const failures = scanPixi3dExtras(root)
  if (failures.length) throw new Error(failures.join('\n'))
  console.log('No Pixi 3D extras in the build.')
}
