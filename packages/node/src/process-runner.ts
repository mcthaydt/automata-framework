import { spawn } from 'node:child_process'
import { Context, Effect, Layer } from 'effect'
import { ProcessError } from './errors.ts'

// Runs a program and collects its output, as an Effect service so tests can replace real processes with a
// recorded fake (ADR 0003, no @effect/platform-node). A non-zero exit code is part of the result: callers
// such as `ship publish` map a program's own exit codes (Ruken's CLI uses 1 to 4) to their own errors.

export interface RunOptions {
  readonly cwd?: string | undefined
  /** Added to the parent's environment. */
  readonly env?: Readonly<Record<string, string>> | undefined
  /** Written to the program's stdin, which is then closed. */
  readonly stdin?: Uint8Array | undefined
  /** Also copy the program's output to this process's stdout and stderr as it arrives. */
  readonly echo?: boolean | undefined
}

export interface RunResult {
  readonly exitCode: number
  readonly stdout: string
  readonly stderr: string
}

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
>('@mcthaydt/automata-node/ProcessRunner')

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

export const ProcessRunnerLive: Layer.Layer<ProcessRunner> = Layer.succeed(ProcessRunner, {
  run: (command, args, options = {}) => runProcess(command, args, options),
})
