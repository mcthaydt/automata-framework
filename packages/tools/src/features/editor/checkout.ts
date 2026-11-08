import { mkdir, open, readdir, realpath, stat, writeFile } from 'node:fs/promises'
import { dirname, join, resolve, sep } from 'node:path'
import type { EditorPolicy } from './editor-policy.ts'

// The game checkout as the editor's server sees it: which real path a request names, what it may list, and how a file
// is written without overwriting someone else's change. The policy (`editor-policy.ts`) says what may be touched; this
// file makes sure a path cannot lead out of the checkout, and that a write knows what it replaces.

/** Folders the editor never lists: version control, installs, builds and the agent's own. */
const OWNED = new Set(['.git', 'node_modules', 'dist', '.vitest', '.claude', '.github', '.automata'])

/** Whether `path` (root-relative, `/`-separated) is inside a folder the editor never reaches. */
export const inOwnedFolder = (path: string): boolean => path.split('/').some((segment) => OWNED.has(segment))

/** One file the editor may read: its path from the checkout, size and modified time. */
export interface ListedFile {
  readonly path: string
  readonly size: number
  readonly mtime: number
}

/** A file's modified time as the editor's stores compare it: whole milliseconds. */
export const mtimeOf = (info: { readonly mtimeMs: number }): number => Math.floor(info.mtimeMs)

/** How a write ended: its new modified time, or the reason it was refused (always 409, a conflict). */
export type WriteOutcome = { readonly mtime: number } | { readonly conflict: string }

/** What the server needs of the checkout. */
export interface Checkout {
  /** `root`/`path` when its real location is inside the checkout (the deepest existing part is checked), else undefined. */
  locate(path: string): Promise<string | undefined>
  /** Every file the policy lets the editor read whose path starts with `prefix`, in path order. */
  list(prefix: string): Promise<ListedFile[]>
  /**
   * Writes `body` to `full` (from `locate`). `expected` is what the editor last read: `absent` means the file must not
   * exist; a number is the modified time it must still have; `null` writes without looking. The check and the write are
   * two steps, as the kit says of its own browser stores.
   */
  write(full: string, path: string, body: Buffer, expected: string | null): Promise<WriteOutcome>
}

/** The checkout at `root` (a real path), read and written as `policy` allows. */
export function openCheckout(root: string, policy: EditorPolicy): Checkout {
  async function walk(dir: string, relative: string, out: ListedFile[]): Promise<void> {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      if (entry.isSymbolicLink() || OWNED.has(entry.name)) continue
      const path = relative === '' ? entry.name : `${relative}/${entry.name}`
      if (entry.isDirectory()) await walk(join(dir, entry.name), path, out)
      else if (entry.isFile() && policy.canRead(path)) {
        const info = await stat(join(dir, entry.name))
        out.push({ path, size: info.size, mtime: mtimeOf(info) })
      }
    }
  }

  return {
    async locate(path) {
      const full = resolve(root, path)
      let probe = full
      for (;;) {
        try {
          const real = await realpath(probe)
          return real === root || real.startsWith(root + sep) ? full : undefined
        } catch {
          const parent = dirname(probe)
          if (parent === probe) return undefined
          probe = parent
        }
      }
    },

    async list(prefix) {
      const entries: ListedFile[] = []
      await walk(root, '', entries)
      return entries
        .filter((entry) => entry.path.startsWith(prefix))
        .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))
    },

    async write(full, path, body, expected) {
      const current = await stat(full).catch(() => undefined)
      if (expected === 'absent') {
        if (current !== undefined) return { conflict: `${path} is there already` }
        await mkdir(dirname(full), { recursive: true })
        try {
          const handle = await open(full, 'wx')
          await handle.writeFile(body)
          await handle.close()
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code === 'EEXIST')
            return { conflict: `${path} is there already` }
          throw error
        }
      } else {
        if (expected !== null && (current === undefined || mtimeOf(current) !== Number(expected)))
          return { conflict: `${path} changed on disk since the editor read it` }
        await mkdir(dirname(full), { recursive: true })
        await writeFile(full, body)
      }
      return { mtime: mtimeOf(await stat(full)) }
    },
  }
}
