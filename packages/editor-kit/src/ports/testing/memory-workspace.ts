// The in-memory suite workspace (editor suite spec §4.3): a kit memory store behind resolved editor-list rows. It takes
// the rows already resolved per path (`WorkspaceFile`), so the list's globs, `never` and `generated` stay the
// policy's (EDS.1c) and are never copied here: a path with no row is refused, a read-only row is refused with its
// reason, and `remove` takes only a file the open change set created.
import { createMemoryStore } from '../../storage/memory-store'
import { type ProjectStore, statPath, type WriteResult } from '../../storage/project-store'
import type { SuiteWorkspace, WorkspaceFile } from '../suite-ports'
import type { MemoryChangeSet } from './memory-change-set'

export interface MemoryWorkspaceOptions {
  /** The files present at the start, by path. */
  readonly files?: Readonly<Record<string, string>> | undefined
  /** The editor list's rows, one per path. */
  readonly rows: readonly WorkspaceFile[]
  /** The compiler outputs `generated` reads (they are files in the store too). */
  readonly generated?: readonly string[] | undefined
  /** The change set whose journal records what this workspace creates; without one, nothing can be removed. */
  readonly changeSet?: Pick<MemoryChangeSet, 'noteCreated' | 'noteRemoved' | 'created'> | undefined
  /** The store underneath (default: a fresh memory store). */
  readonly store?: ProjectStore | undefined
}

const decoder = new TextDecoder()

const refused = (message: string): WriteResult => ({ ok: false, reason: 'policy', message })

export async function createMemoryWorkspace(options: MemoryWorkspaceOptions): Promise<SuiteWorkspace> {
  const store = options.store ?? createMemoryStore()
  const rows = new Map(options.rows.map((row) => [row.path, row]))
  const generated = new Set(options.generated ?? [])
  const { changeSet } = options
  for (const [path, text] of Object.entries(options.files ?? {})) await store.write(path, text)

  const readText = async (path: string): Promise<string | undefined> => {
    const bytes = await store.read(path)
    return bytes === undefined ? undefined : decoder.decode(bytes)
  }

  /** Why the rules refuse a write to `path`, or `undefined` when they allow it. */
  const writeRefusal = (path: string): string | undefined => {
    const row = rows.get(path)
    if (row === undefined)
      return `${path}: no row of the editor list matches it, so the suite does not write it`
    if (!row.writable) return `${path} is read only: ${row.why ?? 'its row does not allow writes'}`
    return undefined
  }

  return {
    async files(editor, scene) {
      const entries = await store.list()
      return entries.flatMap(({ path }) => {
        const row = rows.get(path)
        if (row === undefined) return []
        if (editor !== undefined && row.editor !== editor) return []
        if (scene !== undefined && row.scene !== scene) return []
        return [row]
      })
    },

    async read(path) {
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
      return generated.has(path) ? readText(path) : undefined
    },
  }
}
