import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

// The 3D template needs @automata/3d, which stays private until Pixi 3D is public. Until then `create-game` offers the
// template only where that package is: inside this repository's workspace, or where AF_BETA_3D=1 says the author has it.

/** What an author is told when they ask for a 3D game and the package is not there. */
export const THREE_D_NOT_PUBLIC =
  '3D games need a package that is not public yet. For now, make a 2D game: leave out --template.'

/** True when `dir` or a folder above it holds `packages/3d` with the 3D package in it. */
function workspaceHas3d(dir: string): boolean {
  for (let current = dir; ; current = dirname(current)) {
    const manifest = join(current, 'packages/3d/package.json')
    if (existsSync(manifest)) {
      try {
        if ((JSON.parse(readFileSync(manifest, 'utf8')) as { name?: unknown }).name === '@automata/3d')
          return true
      } catch {
        // A manifest that cannot be read is not the 3D package.
      }
    }
    if (dirname(current) === current) return false
  }
}

/**
 * Whether this run can make a 3D game: AF_BETA_3D is exactly "1", or the tools run from a checkout of this repository
 * (found by walking up from `from`, which is this file from source and the bundle in a published install, where it finds nothing).
 */
export function threeDAvailable(
  env: Readonly<Record<string, string | undefined>> = process.env,
  from: string = dirname(fileURLToPath(import.meta.url)),
): boolean {
  return env.AF_BETA_3D === '1' || workspaceHas3d(from)
}
