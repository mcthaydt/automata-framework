// The process service this Node tool runs on, as an Effect service so tests can swap it. Plain `node:child_process`
// behind the name the tool uses.
import { spawn } from 'node:child_process'
import { Context, Data, Effect, Layer } from 'effect'
import { describe, type TaggedErrorClass } from './files.ts'

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
