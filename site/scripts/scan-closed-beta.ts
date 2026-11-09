// The last step of `pnpm build`: no page of the site may carry Pixi 3D. `@pixi/3d` is a closed beta whose terms allow
// no public deployment, and the site is public, so a build with it (an editor page that pulled in the 3D runtime, say)
// fails here rather than on the host. The markers and the walk are the build tools' own (`findPixi3d`), the same scan
// `automata ship` runs on a game; the site depends on the tools, never the other way round.
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { findPixi3d } from '@automata/tools/internal'

/** One message per built file that carries Pixi 3D or its extras; an empty list means the build is clean. */
export function scanClosedBeta(root: string): string[] {
  const { core, extras } = findPixi3d(root)
  return [...core, ...extras].map(
    ({ file, marker }) =>
      `${file}: carries the Pixi 3D closed beta ("${marker}"); it cannot go on a public site`,
  )
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const root = resolve(process.argv[2] ?? 'build')
  const failures = scanClosedBeta(root)
  if (failures.length) throw new Error(failures.join('\n'))
  console.log('No Pixi 3D closed beta in the build.')
}
