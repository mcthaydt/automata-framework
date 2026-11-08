// The in-memory suite workspace: a kit memory store behind the editor list's policy. The
// policy comes in as functions (editor-suite's `workspaceFile` bound to a loaded list, in the suite and in the
// contract run), so the list's globs, `never` and `generated` have one owner and are never copied here: a
// path no row matches is refused, a read-only file is refused with its reason, a path outside the root reads as
// nothing, and `remove` takes only a file this workspace created.

import type { SuiteWorkspace, UnlistedFile, WorkspaceFile } from '../../../shared/kit/ports/suite-ports'
import { createMemoryStore } from '../../../shared/kit/storage/memory-store'
import { type ProjectStore, statPath, type WriteResult } from '../../../shared/kit/storage/project-store'
import { assertStorePath } from '../../../shared/kit/storage/store-path'

export interface MemoryWorkspaceOptions {
  /** The files present at the start, by path. */
  readonly files?: Readonly<Record<string, string>> | undefined
  /** How the editor list classes a path: a row's file (writable or read only), or no row with the reason. */
  readonly classify: (path: string) => WorkspaceFile | UnlistedFile
  /** Whether a path is a compiler output, which `generated` reads (it is a file in the store too). */
  readonly generated?: ((path: string) => boolean) | undefined
  /** The store underneath (default: a fresh memory store). */
  readonly store?: ProjectStore | undefined
}

const decoder = new TextDecoder()

const refused = (message: string): WriteResult => ({ ok: false, reason: 'policy', message })

export async function createMemoryWorkspace(options: MemoryWorkspaceOptions): Promise<SuiteWorkspace> {
  const store = options.store ?? createMemoryStore()
  const { classify } = options
  /** The paths this workspace made (a write expecting `'absent'`): the only ones `remove` takes. */
  const created = new Set<string>()
  const isGenerated = options.generated ?? (() => false)
  for (const [path, text] of Object.entries(options.files ?? {})) await store.write(path, text)

  /** Inside the root: relative, `/`-separated, no empty, `.` or `..` segment, no backslash (the store's own rule). */
  const insideRoot = (path: string): boolean => {
    try {
      assertStorePath(path)
      return true
    } catch {
      return false
    }
  }

  const readText = async (path: string): Promise<string | undefined> => {
    if (!insideRoot(path)) return undefined
    const bytes = await store.read(path)
    return bytes === undefined ? undefined : decoder.decode(bytes)
  }

  /** Why the rules refuse a write to `path`, or `undefined` when they allow it. */
  const writeRefusal = (path: string): string | undefined => {
    if (!insideRoot(path)) return `${path} is not a path inside the game root`
    const file = classify(path)
    return file.writable ? undefined : `${path} is read only: ${file.why ?? 'its row does not allow writes'}`
  }

  return {
    async files(editor, scene) {
      const entries = await store.list()
      return entries.flatMap(({ path }) => {
        const file = classify(path)
        if (file.editor === undefined) return []
        if (editor !== undefined && file.editor !== editor) return []
        if (scene !== undefined && file.scene !== scene) return []
        return [file]
      })
    },

    async list(folder) {
      if (!insideRoot(folder)) return []
      // A folder is its name and a slash, so `world-props.bak` is not in `world-props`.
      const entries = await store.list(`${folder}/`)
      return entries.map((entry) => entry.path)
    },

    async read(path) {
      if (!insideRoot(path)) return undefined
      const entry = await statPath(store, path)
      const text = await readText(path)
      return entry === undefined || text === undefined ? undefined : { text, mtime: entry.mtime }
    },

    async readBytes(path) {
      return insideRoot(path) ? store.read(path) : undefined
    },

    async write(path, text, expected) {
      const refusal = writeRefusal(path)
      if (refusal !== undefined) return refused(refusal)
      const written = await store.write(path, text, expected)
      if (written.ok && expected === 'absent') created.add(path)
      return written
    },

    async writeBytes(path, bytes, expected) {
      const refusal = writeRefusal(path)
      if (refusal !== undefined) return refused(refusal)
      const written = await store.write(path, bytes, expected)
      if (written.ok && expected === 'absent') created.add(path)
      return written
    },

    async remove(path, expected) {
      if (!insideRoot(path)) return refused(`${path} is not a path inside the game root`)
      if (!created.has(path)) return refused(`${path} was not created here, so the suite does not remove it`)
      const entry = await statPath(store, path)
      if (entry?.mtime !== expected.mtime) {
        const message =
          entry === undefined ? 'The file no longer exists.' : 'The file changed since it was written.'
        return { ok: false, reason: 'conflict', message }
      }
      await store.remove(path)
      created.delete(path)
      return { ok: true, mtime: entry.mtime }
    },

    async generated(path) {
      return insideRoot(path) && isGenerated(path) ? readText(path) : undefined
    },
  }
}
