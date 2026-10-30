// One command, run as argv with no shell (editor suite spec §4.2: the list's `run` is argv; The Last Light's runner
// rules at `92e6704`, `editor/src/server/checks.ts`). Output past `OUTPUT_CAP` is cut, not buffered, so a chatty
// command cannot fill the server's memory. It never rejects: a command that cannot start, is aborted or runs past its
// time gives `error`, and the caller decides what that means.
import { spawn } from 'node:child_process'

/** 200 KB, stdout and stderr together. */
export const OUTPUT_CAP: number = 200 * 1024

export interface ArgvOptions {
  readonly cwd: string
  readonly env?: NodeJS.ProcessEnv | undefined
  /** Aborting kills the command; its reason (a string) is the result's `error`. */
  readonly signal?: AbortSignal | undefined
  readonly timeoutMs?: number | undefined
}

export interface ArgvResult {
  /** The exit code; undefined when the command did not exit by itself (it could not start, or it was killed). */
  readonly code?: number | undefined
  readonly stdout: string
  readonly stderr: string
  /** True when output past `OUTPUT_CAP` was dropped. */
  readonly truncated: boolean
  /** Why the command has no exit code of its own. */
  readonly error?: string | undefined
}

export function runArgv(argv: readonly string[], options: ArgvOptions): Promise<ArgvResult> {
  const [command, ...args] = argv
  if (command === undefined)
    return Promise.resolve({ stdout: '', stderr: '', truncated: false, error: 'the command is empty' })
  return new Promise((resolve) => {
    const stdout: Buffer[] = []
    const stderr: Buffer[] = []
    let kept = 0
    let truncated = false
    let stopped: string | undefined
    const child = spawn(command, args, { cwd: options.cwd, env: options.env ?? process.env, shell: false })

    const keep = (into: Buffer[]) => (chunk: Buffer) => {
      const room = OUTPUT_CAP - kept
      if (chunk.length > room) truncated = true
      if (room <= 0) return
      const part = chunk.subarray(0, room)
      into.push(part)
      kept += part.length
    }
    child.stdout.on('data', keep(stdout))
    child.stderr.on('data', keep(stderr))

    const stop = (reason: string) => {
      stopped ??= reason
      child.kill('SIGKILL')
    }
    const onAbort = () => stop(String(options.signal?.reason ?? 'aborted'))
    if (options.signal?.aborted === true) onAbort()
    options.signal?.addEventListener('abort', onAbort, { once: true })
    const timer =
      options.timeoutMs === undefined
        ? undefined
        : setTimeout(() => stop(`timed out after ${options.timeoutMs} ms`), options.timeoutMs)

    let started = true
    const finish = (code: number | null, failure?: string) => {
      clearTimeout(timer)
      options.signal?.removeEventListener('abort', onAbort)
      const error = failure ?? stopped ?? (code === null ? 'the command was killed' : undefined)
      resolve({
        ...(error === undefined && code !== null ? { code } : {}),
        stdout: Buffer.concat(stdout).toString('utf8'),
        stderr: Buffer.concat(stderr).toString('utf8'),
        truncated,
        ...(error === undefined ? {} : { error }),
      })
    }
    child.on('error', (failure) => {
      started = false
      finish(null, failure.message)
    })
    child.on('close', (code) => {
      if (started) finish(code)
    })
  })
}
