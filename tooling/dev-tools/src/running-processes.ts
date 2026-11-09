import { Effect } from 'effect'
import { ProcessRunner } from './node-seams.ts'

/**
 * Every process's working folder, or why it cannot be known. `worktree-gc` keeps a worktree with a process working
 * in it, and keeps every worktree when it cannot tell (plan DT-D3): a process that only holds a file open there is
 * not seen.
 */
export type ProcessTable =
  | { readonly kind: 'known'; readonly cwds: ReadonlyArray<{ readonly pid: number; readonly cwd: string }> }
  | { readonly kind: 'unknown'; readonly reason: string }

/**
 * `lsof -w -d cwd -Fpn` lists each process as a `p<pid>` line and its working folder as an `n<path>` line, on macOS
 * and Linux alike. A non-zero exit with a list still counts (lsof exits 1 when it could not read some other user's
 * process); a non-zero exit with nothing listed does not.
 */
export function runningProcesses(): Effect.Effect<ProcessTable, never, ProcessRunner> {
  return Effect.gen(function* () {
    const runner = yield* ProcessRunner
    const result = yield* runner.run('lsof', ['-w', '-d', 'cwd', '-Fpn']).pipe(Effect.either)
    if (result._tag === 'Left') return { kind: 'unknown', reason: 'lsof could not be started' } as const
    const { exitCode, stdout, stderr } = result.right
    if (exitCode !== 0 && stdout.trim() === '')
      return { kind: 'unknown', reason: `lsof exited ${exitCode}: ${stderr.trim()}` } as const
    const cwds: Array<{ pid: number; cwd: string }> = []
    let pid: number | null = null
    for (const line of stdout.split('\n')) {
      if (line.startsWith('p')) pid = Number(line.slice(1))
      else if (line.startsWith('n') && pid !== null) cwds.push({ pid, cwd: line.slice(1) })
    }
    return { kind: 'known', cwds } as const
  })
}

/** The pids working in `path` or below it, sorted; null when the table cannot tell. */
export function pidsInside(table: ProcessTable, path: string): number[] | null {
  if (table.kind === 'unknown') return null
  return table.cwds
    .filter(({ cwd }) => cwd === path || cwd.startsWith(`${path}/`))
    .map(({ pid }) => pid)
    .sort((a, b) => a - b)
}
