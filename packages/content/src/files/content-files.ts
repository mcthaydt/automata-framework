// Every file the compiler touches goes through this module, so the package has one place that knows about
// the disk. It uses `node:fs` inside Effect today; when `@mcthaydt/automata-node` lands, swapping it in is a
// change to this file alone. The rest of the package sees Effects that fail with `FileError`.

import { randomUUID } from 'node:crypto'
import { mkdir, readdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import { dirname, join, relative } from 'node:path'
import { Data, Effect } from 'effect'
import type { TaggedErrorClass } from '../compile/errors'

const FileErrorBase: TaggedErrorClass<'FileError', { readonly path: string; readonly cause: unknown }> =
  Data.TaggedError('FileError')

export class FileError extends FileErrorBase {}

const isMissing = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && (error as { code?: unknown }).code === 'ENOENT'

const attempt = <A>(path: string, run: () => Promise<A>): Effect.Effect<A, FileError> =>
  Effect.tryPromise({ try: run, catch: (cause) => new FileError({ path, cause }) })

/** A file's UTF-8 text, or undefined when there is no file at `path`. */
export const readTextIfPresent = (path: string): Effect.Effect<string | undefined, FileError> =>
  attempt(path, async () => {
    try {
      return await readFile(path, 'utf8')
    } catch (error) {
      if (isMissing(error)) return undefined
      throw error
    }
  })

/**
 * Every file below `folder`, as `/`-separated paths relative to it, sorted by code unit so the order never
 * depends on the disk or the locale. An absent folder lists nothing: a game that has no songs yet has an
 * empty `content/songs/`, not a broken one (FloorFifty).
 */
export const listFiles = (folder: string): Effect.Effect<string[], FileError> =>
  attempt(folder, async () => {
    try {
      const entries = await readdir(folder, { recursive: true, withFileTypes: true })
      return entries
        .filter((entry) => entry.isFile())
        .map((entry) => relative(folder, join(entry.parentPath, entry.name)).replaceAll('\\', '/'))
        .sort()
    } catch (error) {
      if (isMissing(error)) return []
      throw error
    }
  })

/**
 * Replaces a file so that a reader sees either the old text or the new, never half of it (FloorFifty
 * build.ts `writeAtomically`). The temp file sits beside the target because a rename is only atomic within
 * one filesystem, and it is removed whether or not the rename happened.
 */
export const writeFileAtomically = (path: string, text: string): Effect.Effect<void, FileError> =>
  attempt(path, async () => {
    const temporary = `${path}.${process.pid}.${randomUUID()}.tmp`
    await mkdir(dirname(path), { recursive: true })
    try {
      await writeFile(temporary, text, 'utf8')
      await rename(temporary, path)
    } finally {
      await rm(temporary, { force: true })
    }
  })

/** Whether `path` is a file, a folder, or nothing. */
export const pathKind = (path: string): Effect.Effect<'file' | 'folder' | undefined, FileError> =>
  attempt(path, async () => {
    try {
      const stats = await stat(path)
      return stats.isDirectory() ? 'folder' : 'file'
    } catch (error) {
      if (isMissing(error)) return undefined
      throw error
    }
  })

/** Deletes the file at `path`; nothing there is not an error. */
export const removeFile = (path: string): Effect.Effect<void, FileError> =>
  attempt(path, () => rm(path, { force: true }))
