// The in-memory suite workspace (editor suite spec §4.3): a kit memory store behind the editor list's policy. The
// policy comes in as functions (editor-suite's `workspaceFile` bound to a loaded list, in the suite and in the
// contract run), so the list's globs, `never` and `generated` have one owner (EDS.1c) and are never copied here: a
// path no row matches is refused, a read-only file is refused with its reason, a path outside the root reads as
// nothing, and `remove` takes only a file the open change set created.
import { createMemoryStore } from '../../storage/memory-store'
import { type ProjectStore, statPath, type WriteResult } from '../../storage/project-store'
import { assertStorePath } from '../../storage/store-path'
import type { SuiteWorkspace, UnlistedFile, WorkspaceFile } from '../suite-ports'
import type { MemoryChangeSet } from './memory-change-set'

export interface MemoryWorkspaceOptions {
  /** The files present at the start, by path. */
  readonly files?: Readonly<Record<string, string>> | undefined
  /** How the editor list classes a path: a row's file (writable or read only), or no row with the reason. */
  readonly classify: (path: string) => WorkspaceFile | UnlistedFile
  /** Whether a path is a compiler output, which `generated` reads (it is a file in the store too). */
  readonly generated?: ((path: string) => boolean) | undefined
  /** The change set whose journal records what this workspace creates; without one, nothing can be removed. */
  readonly changeSet?: Pick<MemoryChangeSet, 'noteCreated' | 'noteRemoved' | 'created'> | undefined
  /** The store underneath (default: a fresh memory store). */
  readonly store?: ProjectStore | undefined
}

const decoder = new TextDecoder()

const refused = (message: string): WriteResult => ({ ok: false, reason: 'policy', message })

export async function createMemoryWorkspace(options: MemoryWorkspaceOptions): Promise<SuiteWorkspace> {
  const store = options.store ?? createMemoryStore()
  const { classify, changeSet } = options
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

    async read(path) {
      if (!insideRoot(path)) return undefined
      const entry = await statPath(store, path)
      const text = await readText(path)
      return entry === undefined || text === undefined ? undefined : { text, mtime: entry.mtime }
    },

    async write(path, text, expected) {
      const refusal = writeRefusal(path)
      if (refusal !== undefined) return refused(refusal)
      const written = await store.write(path, text, expected)
      if (written.ok && expected === 'absent') changeSet?.noteCreated(path)
      return written
    },

    async remove(path, expected) {
      if (!insideRoot(path)) return refused(`${path} is not a path inside the game root`)
      if (changeSet?.created(path) !== true)
        return refused(`${path} was not created by this change set, so the suite does not remove it`)
      const entry = await statPath(store, path)
      if (entry?.mtime !== expected.mtime) {
        const message =
          entry === undefined ? 'The file no longer exists.' : 'The file changed since it was written.'
        return { ok: false, reason: 'conflict', message }
      }
      await store.remove(path)
      changeSet.noteRemoved(path)
      return { ok: true, mtime: entry.mtime }
    },

    async generated(path) {
      return insideRoot(path) && isGenerated(path) ? readText(path) : undefined
    },
  }
}
