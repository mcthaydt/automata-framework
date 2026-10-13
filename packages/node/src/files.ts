import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, sep } from 'node:path'
import { Context, Effect, Layer } from 'effect'
import { FileError } from './errors.ts'

// The file operations AF's build-time code needs (ship, content, the CLI), as an Effect service so callers
// get typed errors and tests can swap the implementation. It wraps `node:fs` in `Effect.try` instead of using
// `@effect/platform-node`, whose 0.108 line pulls in cluster, rpc, sql and workflow packages (ADR 0003).
// The calls are synchronous: build steps touch a handful of files, and sync calls keep errors in order.

export interface FilesService {
  readText(path: string): Effect.Effect<string, FileError>
  /** Writes UTF-8 text, creating parent folders. */
  writeText(path: string, text: string): Effect.Effect<void, FileError>
  exists(path: string): Effect.Effect<boolean>
  /** Every file below `dir`, as `/`-separated paths relative to it, sorted. */
  listFiles(dir: string): Effect.Effect<readonly string[], FileError>
  /** Removes a file or folder recursively; a missing path is not an error. */
  remove(path: string): Effect.Effect<void, FileError>
}

/**
 * The service's tag. A tag and an identity interface instead of `class Files extends Context.Tag(...)`, because
 * isolatedDeclarations cannot type a call in an `extends` clause (the pattern `host`'s `Hosting` uses).
 */
export interface Files {
  readonly _Files: unique symbol
}
export const Files: Context.Tag<Files, FilesService> = Context.GenericTag<Files, FilesService>(
  '@mcthaydt/automata-node/Files',
)

const attempt = <A>(path: string, run: () => A): Effect.Effect<A, FileError> =>
  Effect.try({ try: run, catch: (cause) => new FileError({ path, cause }) })

function listBelow(root: string): string[] {
  return readdirSync(root, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => relative(root, join(entry.parentPath, entry.name)).split(sep).join('/'))
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
}

export const FilesLive: Layer.Layer<Files> = Layer.succeed(Files, {
  readText: (path) => attempt(path, () => readFileSync(path, 'utf8')),
  writeText: (path, text) =>
    attempt(path, () => {
      mkdirSync(dirname(path), { recursive: true })
      writeFileSync(path, text)
    }),
  exists: (path) => Effect.sync(() => existsSync(path)),
  listFiles: (dir) => attempt(dir, () => listBelow(dir)),
  remove: (path) => attempt(path, () => rmSync(path, { recursive: true, force: true })),
})
