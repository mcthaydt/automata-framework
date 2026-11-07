// The file service this Node tool runs on, as an Effect service so tests can swap it (the framework's own tools
// package keeps the same one inside; it is not a public entry). Plain `node:fs` behind the names the tool uses.
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, sep } from 'node:path'
import { type Cause, Context, Data, Effect, Layer } from 'effect'

/**
 * The class `Data.TaggedError(tag)` returns, written out. isolatedDeclarations cannot infer the type of a call in
 * an `extends` clause, so each error extends a constant annotated with this type instead (the pattern of
 * `content`'s compile errors and `host`'s errors). `ship` uses it for its own errors.
 */
export type TaggedErrorClass<Tag extends string, Fields> = new (
  fields: Fields,
) => Cause.YieldableError & { readonly _tag: Tag } & Readonly<Fields>

export const describe = (cause: unknown): string => (cause instanceof Error ? cause.message : String(cause))

const FileErrorBase: TaggedErrorClass<'FileError', { readonly path: string; readonly cause: unknown }> =
  Data.TaggedError('FileError')

/** Reading, writing, listing or removing a file failed. */
export class FileError extends FileErrorBase {
  override get message(): string {
    return `${this.path}: ${describe(this.cause)}`
  }
}

/** Runs a synchronous file operation, and fails with a `FileError` naming `path` when it throws. */
export const tryFile = <A>(path: string, run: () => A): Effect.Effect<A, FileError> =>
  Effect.try({ try: run, catch: (cause) => new FileError({ path, cause }) })

// The file operations AF's build-time code needs (ship, content, the CLI), as an Effect service so callers
// get typed errors and tests can swap the implementation. It wraps `node:fs` in `Effect.try` instead of using
// `@effect/platform-node`, whose 0.108 line pulls in cluster, rpc, sql and workflow packages (ADR 0003).
// The calls are synchronous: build steps touch a handful of files, and sync calls keep errors in order.

/**
 * The file operations build-time code needs, each as an Effect. A failed call fails with a `FileError` naming
 * the path, except `exists`, which cannot fail.
 */
export interface FilesService {
  readText(path: string): Effect.Effect<string, FileError>
  /**
   * The file's bytes exactly as they are on disk, for binary inputs such as images: reading them as text
   * would replace every byte that is not valid UTF-8. The array owns its bytes (it is not a Node `Buffer`).
   */
  readBytes(path: string): Effect.Effect<Uint8Array, FileError>
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
  '@automata/pipelines/Files',
)

function listBelow(root: string): string[] {
  return readdirSync(root, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => relative(root, join(entry.parentPath, entry.name)).split(sep).join('/'))
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
}

/**
 * `Files` on `node:fs`: synchronous calls wrapped in `Effect.try`, so the first failure surfaces as a
 * `FileError`.
 */
export const FilesLive: Layer.Layer<Files> = Layer.succeed(Files, {
  readText: (path) => tryFile(path, () => readFileSync(path, 'utf8')),
  // Copied out of the Buffer: a small one is a view into Node's shared pool, so its `.buffer` holds other
  // data that a hasher reading the whole ArrayBuffer would take in.
  readBytes: (path) => tryFile(path, () => new Uint8Array(readFileSync(path))),
  writeText: (path, text) =>
    tryFile(path, () => {
      mkdirSync(dirname(path), { recursive: true })
      writeFileSync(path, text)
    }),
  exists: (path) => Effect.sync(() => existsSync(path)),
  listFiles: (dir) => tryFile(dir, () => listBelow(dir)),
  remove: (path) => tryFile(path, () => rmSync(path, { recursive: true, force: true })),
})
