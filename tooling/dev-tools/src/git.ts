import { Effect } from 'effect'
import { ProcessRunner } from './node-seams.ts'

/** A git call's result: its output, or the reason it failed (a non-zero exit, or git could not be started). */
export type GitResult =
  | { readonly ok: true; readonly stdout: string }
  | { readonly ok: false; readonly message: string }

/** `git -C <dir> <args…>` through `ProcessRunner`, so tests answer it from a fake. Never fails as an effect. */
export function git(dir: string, args: readonly string[]): Effect.Effect<GitResult, never, ProcessRunner> {
  return Effect.gen(function* () {
    const runner = yield* ProcessRunner
    const result = yield* runner.run('git', ['-C', dir, ...args]).pipe(Effect.either)
    if (result._tag === 'Left') return { ok: false, message: 'git could not be started' } as const
    const { exitCode, stdout, stderr } = result.right
    if (exitCode !== 0)
      return { ok: false, message: stderr.trim() || `git ${args.join(' ')} exited ${exitCode}` } as const
    return { ok: true, stdout } as const
  })
}
