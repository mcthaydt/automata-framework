// Workspaces for the tests of what Levels 3D reads from a game: base-3d as it is on disk, and a game with nothing but a
// level. Only `read` and `list` are real; a test of the library never writes.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import type { SuiteWorkspace } from '@automata/editor/kit/ports'

const BASE_3D = new URL('../../../../games/base-3d/', import.meta.url).pathname

function walk(root: string, folder: string): string[] {
  const here = join(root, folder)
  try {
    return readdirSync(here).flatMap((name) => {
      const path = join(here, name)
      return statSync(path).isDirectory() ? walk(root, relative(root, path)) : [relative(root, path)]
    })
  } catch {
    return []
  }
}

/** A read-only workspace over a map of files; `list` is the portable folder listing the suite port offers. */
export function filesWorkspace(files: Readonly<Record<string, string>>, withList = true): SuiteWorkspace {
  const refuse = (): never => {
    throw new Error('this workspace is for reading')
  }
  return {
    files: refuse,
    read: async (path) => (path in files ? { text: files[path] as string, mtime: 1 } : undefined),
    ...(withList
      ? {
          list: async (folder: string) =>
            Object.keys(files)
              .filter((path) => path.startsWith(`${folder}/`))
              .sort(),
        }
      : {}),
    write: refuse,
    remove: refuse,
    generated: async () => undefined,
  }
}

/** base-3d's `content/` folder, every file as text. */
export function base3dWorkspace(): SuiteWorkspace {
  const files: Record<string, string> = {}
  for (const path of walk(BASE_3D, 'content'))
    if (/\.(toml|json)$/.test(path) && !path.includes('generated/'))
      files[path] = readFileSync(join(BASE_3D, path), 'utf8')
  return filesWorkspace(files)
}

/** A game with a level and no library folders. */
export const emptyWorkspace = (): SuiteWorkspace => filesWorkspace({})
