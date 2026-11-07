// The file and process services this Node tool runs on, as Effect services so tests can swap them (the
// framework's own tools package keeps the same pair inside; neither is a public entry). Plain `node:fs` and
// `node:child_process` behind the names the tool already uses.
import { spawn } from 'node:child_process'
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

const describe = (cause: unknown): string => (cause instanceof Error ? cause.message : String(cause))

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

const ProcessErrorBase: TaggedErrorClass<
  'ProcessError',
  { readonly command: string; readonly cause: unknown }
> = Data.TaggedError('ProcessError')

/** A program could not be started (not found, not executable). A non-zero exit is not this error. */
export class ProcessError extends ProcessErrorBase {
  override get message(): string {
    return `could not run ${this.command}: ${describe(this.cause)}`
  }
}

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

// Runs a program and collects its output, as an Effect service so tests can replace real processes with a
// recorded fake (ADR 0003, no @effect/platform-node). A non-zero exit code is part of the result: callers
// such as `ship publish` map a program's own exit codes (Ruken's CLI uses 1 to 4) to their own errors.

/**
 * How a program is started: its working folder, extra environment, stdin, and whether its output is also
 * echoed.
 */
export interface RunOptions {
  readonly cwd?: string | undefined
  /** Added to the parent's environment. */
  readonly env?: Readonly<Record<string, string>> | undefined
  /** Written to the program's stdin, which is then closed. */
  readonly stdin?: Uint8Array | undefined
  /** Also copy the program's output to this process's stdout and stderr as it arrives. */
  readonly echo?: boolean | undefined
}

/**
 * What a finished program left: its exit code (128 when a signal killed it) and everything it wrote to stdout
 * and stderr, decoded as UTF-8. A non-zero exit code is a result, not a failure.
 */
export interface RunResult {
  readonly exitCode: number
  readonly stdout: string
  readonly stderr: string
}

/**
 * Runs a program with arguments and no shell. The effect fails with a `ProcessError` only when the program
 * cannot be started; interrupting it stops the program.
 */
export interface ProcessRunnerService {
  run(command: string, args: readonly string[], options?: RunOptions): Effect.Effect<RunResult, ProcessError>
}

/** The service's tag; see `Files` for why it is not a `Context.Tag` class. */
export interface ProcessRunner {
  readonly _ProcessRunner: unique symbol
}
export const ProcessRunner: Context.Tag<ProcessRunner, ProcessRunnerService> = Context.GenericTag<
  ProcessRunner,
  ProcessRunnerService
>('@automata/pipelines/ProcessRunner')

function runProcess(
  command: string,
  args: readonly string[],
  options: RunOptions,
): Effect.Effect<RunResult, ProcessError> {
  return Effect.async<RunResult, ProcessError>((resume) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: { ...process.env, ...options.env },
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    const stdout: Buffer[] = []
    const stderr: Buffer[] = []
    child.stdout.on('data', (chunk: Buffer) => {
      stdout.push(chunk)
      if (options.echo === true) process.stdout.write(chunk)
    })
    child.stderr.on('data', (chunk: Buffer) => {
      stderr.push(chunk)
      if (options.echo === true) process.stderr.write(chunk)
    })
    // 'error' fires when the program cannot be started (ENOENT, EACCES); 'close' never follows it.
    child.on('error', (cause) => resume(Effect.fail(new ProcessError({ command, cause }))))
    child.on('close', (code, signal) => {
      resume(
        Effect.succeed({
          // A program killed by a signal has no exit code; report it like a shell does (128 + signal number).
          exitCode: code ?? (signal === null ? 1 : 128),
          stdout: Buffer.concat(stdout).toString('utf8'),
          stderr: Buffer.concat(stderr).toString('utf8'),
        }),
      )
    })
    child.stdin.on('error', () => undefined) // the program may exit before reading its input
    child.stdin.end(options.stdin === undefined ? undefined : Buffer.from(options.stdin))
    // Interrupting the Effect stops the program.
    return Effect.sync(() => {
      child.kill()
    })
  })
}

/**
 * `ProcessRunner` on `node:child_process`: the real programs, with the parent's environment plus
 * `RunOptions.env`.
 */
export const ProcessRunnerLive: Layer.Layer<ProcessRunner> = Layer.succeed(ProcessRunner, {
  run: (command, args, options = {}) => runProcess(command, args, options),
})
