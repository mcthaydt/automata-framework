import type { BeforeSaveStop } from '../../shared/kit/storage/document-session.ts'
import type { ProjectStore } from '../../shared/kit/storage/project-store.ts'
import {
  type FolderWrite,
  type Seen,
  seenFiles,
  writeToFolder,
} from '../../shared/kit/storage/write-folder.ts'
import type { ExportTarget } from '../../shared/level-2d/profiles/profile.ts'

// Writing a game's files when a level project is saved. On a checkout whose editor list gives the project an `exports`
// folder, the files the profile's game target makes go there first and the project goes last, so a project on disk is
// never newer than the game files made from it. Each write is guarded by the version this editor last saw, so a file
// someone else changed stops the save before anything is written. The store has no transaction: a failure part-way
// leaves the files before it written, and the next save writes them all again.

export interface GameSave {
  /** The folder the files go into. */
  readonly folder: string
  /** Writes the game files for the current value; the document session calls it before it writes the document. */
  write(
    value: unknown,
    base: () => string,
    mode: 'guarded' | 'overwrite',
  ): Promise<BeforeSaveStop | undefined>
}

/** The files `target` makes for `value`, under `folder`. */
function filesOf(
  target: ExportTarget<unknown>,
  folder: string,
  value: unknown,
  base: string,
): { path: string; contents: string }[] {
  return target
    .files(value, base)
    .map((file) => ({ path: `${folder}/${file.path}`, contents: file.contents }))
}

/** The path a stopped write stopped at. */
const stoppedAt = (result: Exclude<FolderWrite, { written: number }>): string =>
  'conflict' in result ? result.conflict : result.failed

/** A game save for a document opened with `value`; remembers the versions of the files now on disk. */
export async function createGameSave(
  store: ProjectStore,
  target: ExportTarget<unknown>,
  folder: string,
  opened: { value: unknown; base: string },
): Promise<GameSave> {
  let seen: ReadonlyMap<string, Seen> = await seenFiles(
    store,
    filesOf(target, folder, opened.value, opened.base).map((file) => file.path),
  )
  return {
    folder,
    async write(value, base, mode) {
      const files = filesOf(target, folder, value, base())
      const result = await writeToFolder(store, files, seen, mode)
      // What was written is now the version to expect. A file the write never reached keeps the version it had.
      const reached =
        'written' in result ? files.length : files.findIndex((file) => file.path === stoppedAt(result))
      const fresh = await seenFiles(
        store,
        files.slice(0, Math.max(reached, 0)).map((file) => file.path),
      )
      seen = new Map([...seen, ...fresh])
      if ('written' in result) return undefined
      if ('conflict' in result) return { status: 'conflict' }
      return { status: 'failed', reason: result.reason, message: result.message }
    },
  }
}
