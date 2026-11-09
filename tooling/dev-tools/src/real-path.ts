import { lstat, realpath } from 'node:fs/promises'
import { posix } from 'node:path'
import { Effect } from 'effect'

// Symlink checks for promotion's targets. Core's `Files` has no `realpath` or `lstat`, so these call `node:fs`
// directly (core could be asked for these beside binary I/O). Neither fails: a path that cannot be read counts as
// not a symlink, and resolves through its nearest existing folder.

/** True when `path` itself is a symbolic link (a missing path is not). */
export function isSymlink(path: string): Effect.Effect<boolean> {
  return Effect.promise(() =>
    lstat(path).then(
      (stats) => stats.isSymbolicLink(),
      () => false,
    ),
  )
}

/**
 * Where `path` really is: the real path of its nearest existing ancestor, with the rest appended. A folder that does
 * not exist yet (and that `mkdir -p` will create) resolves where it will be made.
 */
export function resolvedPath(path: string): Effect.Effect<string> {
  return Effect.promise(async () => {
    let existing = posix.normalize(path)
    const rest: string[] = []
    for (;;) {
      try {
        return posix.join(await realpath(existing), ...rest.reverse())
      } catch {
        const parent = posix.dirname(existing)
        if (parent === existing) return posix.normalize(path)
        rest.push(posix.basename(existing))
        existing = parent
      }
    }
  })
}

/** True when `path` is `folder` or below it. */
export const isInside = (path: string, folder: string): boolean =>
  path === folder || path.startsWith(`${folder}/`)
