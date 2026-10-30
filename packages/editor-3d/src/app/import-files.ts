// Importing a folder or a zip into the workspace (ED3D spec §8 and open question 1: on an iPad a game's files reach the
// OPFS workspace this way, and leave it by Export). Every file lands under one root folder, so an import never
// overwrites what is there: a root the workspace already has becomes `name 2`, `name 3`. Nothing is parsed here; Home
// lists what a profile claims, and the rest (textures, notes) is kept beside the levels as it was in the game.
import {
  classifyStorageError,
  type ProjectStore,
  type StorageFailure,
  statPath,
} from '@mcthaydt/automata-editor-kit/core'
import { type UnzipFileInfo, unzipSync } from 'fflate'
import { MAX_FILE_BYTES } from './read-level'

/** A file of a picked folder: `path` is relative and starts with the folder's name (`levels/clinic/blockout.json`). */
export interface PickedFile {
  readonly path: string
  readonly bytes: Uint8Array
}

/** `system`: a file the OS adds (`.DS_Store`, `__MACOSX/`); `unsafePath`: one no store can name; `tooLarge`: over 16 MB. */
export type SkipReason = 'system' | 'unsafePath' | 'tooLarge'

export interface Skipped {
  readonly path: string
  readonly reason: SkipReason
}

export type ImportOutcome =
  | {
      readonly status: 'imported'
      /** The folder everything went under. */
      readonly root: string
      readonly files: readonly string[]
      readonly skipped: readonly Skipped[]
    }
  | { readonly status: 'refused'; readonly reason: 'empty' | 'notZip'; readonly message: string }
  /** The store refused part way: `written` is what is already in the workspace. */
  | {
      readonly status: 'failed'
      readonly root: string
      readonly written: readonly string[]
      readonly reason: StorageFailure
      readonly message: string
    }

/** Where loose files go: picked files with no folder of their own. */
const LOOSE_ROOT = 'Imported'
const SYSTEM_NAMES = new Set(['.DS_Store', 'Thumbs.db', 'desktop.ini'])

/** Why `path` is not imported, if it is not; the store's own path rules, without throwing. */
function skipReason(path: string): SkipReason | undefined {
  const segments = path.split('/')
  if (
    segments.some((segment) => segment === '__MACOSX') ||
    SYSTEM_NAMES.has(segments[segments.length - 1] ?? '')
  )
    return 'system'
  if (path.includes('\\') || path.includes('\0')) return 'unsafePath'
  if (segments.some((segment) => segment === '' || segment === '.' || segment === '..')) return 'unsafePath'
  return undefined
}

/** The root and each file's path under it: a shared first folder is kept, anything else goes under `fallback`. */
function rooted(paths: readonly string[], fallback: string): { root: string; relative: readonly string[] } {
  const first = paths[0]?.split('/')[0]
  const shared =
    first !== undefined && paths.every((path) => path.startsWith(`${first}/`)) ? first : undefined
  if (shared !== undefined)
    return { root: shared, relative: paths.map((path) => path.slice(shared.length + 1)) }
  return { root: fallback, relative: paths }
}

/** `root`, or the first of `root 2`, `root 3` that is neither a file nor a folder in the store. */
async function freeRoot(store: ProjectStore, root: string): Promise<string> {
  const taken = async (name: string): Promise<boolean> =>
    (await statPath(store, name)) !== undefined || (await store.list(`${name}/`)).length > 0
  let free = root
  for (let n = 2; await taken(free); n += 1) free = `${root} ${n}`
  return free
}

async function importEntries(
  store: ProjectStore,
  entries: readonly PickedFile[],
  fallbackRoot: string,
  skippedBefore: readonly Skipped[],
): Promise<ImportOutcome> {
  const skipped = [...skippedBefore]
  const kept: PickedFile[] = []
  for (const entry of entries) {
    const reason =
      skipReason(entry.path) ?? (entry.bytes.byteLength > MAX_FILE_BYTES ? 'tooLarge' : undefined)
    if (reason === undefined) kept.push(entry)
    else skipped.push({ path: entry.path, reason })
  }
  if (kept.length === 0)
    return { status: 'refused', reason: 'empty', message: 'There are no files to import.' }
  const { root: wanted, relative } = rooted(
    kept.map((entry) => entry.path),
    fallbackRoot,
  )
  const written: string[] = []
  let root = wanted
  try {
    root = await freeRoot(store, wanted)
    for (const [index, entry] of kept.entries()) {
      const path = `${root}/${relative[index]}`
      const result = await store.write(path, entry.bytes)
      if (!result.ok)
        return {
          status: 'failed',
          root,
          written,
          reason: result.reason === 'conflict' ? 'io' : result.reason,
          message: result.message,
        }
      written.push(path)
    }
  } catch (error) {
    return { status: 'failed', root, written, ...classifyStorageError(error) }
  }
  return { status: 'imported', root, files: written, skipped }
}

/** Imports a picked folder's files. */
export function importFolder(store: ProjectStore, files: readonly PickedFile[]): Promise<ImportOutcome> {
  if (files.length === 0)
    return Promise.resolve({ status: 'refused', reason: 'empty', message: 'There are no files to import.' })
  return importEntries(store, files, LOOSE_ROOT, [])
}

/**
 * Imports a zip's files. An entry whose declared size is over 16 MB is skipped before it is inflated; folders in the
 * zip are not files and are not listed. `name` is the zip's file name, whose stem is the root of a zip with no single
 * top folder.
 */
export function importZip(store: ProjectStore, name: string, bytes: Uint8Array): Promise<ImportOutcome> {
  const tooLarge: Skipped[] = []
  let unzipped: Record<string, Uint8Array>
  try {
    unzipped = unzipSync(bytes, {
      filter(file: UnzipFileInfo) {
        if (file.name.endsWith('/')) return false
        if (file.originalSize > MAX_FILE_BYTES) {
          tooLarge.push({ path: file.name, reason: 'tooLarge' })
          return false
        }
        return true
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return Promise.resolve({ status: 'refused', reason: 'notZip', message: `Not a zip file: ${message}` })
  }
  const entries = Object.keys(unzipped)
    .sort()
    .map((path) => ({ path, bytes: unzipped[path] ?? new Uint8Array() }))
  const file = name.slice(name.lastIndexOf('/') + 1)
  const stem = file.toLowerCase().endsWith('.zip') ? file.slice(0, -4) : file
  const fallback = skipReason(stem) === undefined && stem !== '' ? stem : LOOSE_ROOT
  return importEntries(store, entries, fallback, tooLarge)
}
