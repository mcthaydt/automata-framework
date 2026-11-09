#!/usr/bin/env node
import { Effect, Layer } from 'effect'
import type { CommandOutput } from '../command-output.ts'
import { FilesLive, ProcessRunnerLive } from '../node-seams.ts'
import { worktreeGc } from '../worktree-gc.ts'

// The `worktree-gc` bin, run by Node from source (imports keep `.ts`; plan DT-D5). Dev-only: the package exports
// nothing a game could import (plan DT-a).

const USAGE = `usage: worktree-gc [--apply] [--base <branch>]
  Reports which worktrees of this repository can go and which test output (playwright-report/, test-results/)
  can be cleared. Changes nothing without --apply.
  A worktree is removed only when it is merged into origin/<branch> (default: main), on a remote, clean, unlocked
  and has no running process; never with --force. Folders under .claude/worktrees that git does not know are
  reported and left for a person.
`

function parse(argv: readonly string[]): CommandOutput | { apply: boolean; base: string } {
  const usageError = (message: string): CommandOutput => ({
    exit: 2,
    stdout: '',
    stderr: `worktree-gc: ${message}; see --help\n`,
  })
  let apply = false
  let base = 'main'
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index] as string
    if (arg === '--help' || arg === '-h') return { exit: 0, stdout: USAGE, stderr: '' }
    if (arg === '--apply') apply = true
    else if (arg === '--base') {
      const value = argv[++index]
      if (value === undefined || value.startsWith('--')) return usageError('--base needs a branch')
      base = value
    } else return usageError(`unknown option '${arg}'`)
  }
  return { apply, base }
}

const parsed = parse(process.argv.slice(2))
const output =
  'exit' in parsed
    ? parsed
    : await Effect.runPromise(
        worktreeGc({ cwd: process.cwd(), ...parsed }).pipe(
          Effect.provide(Layer.merge(FilesLive, ProcessRunnerLive)),
        ),
      )
process.stdout.write(output.stdout)
process.stderr.write(output.stderr)
process.exitCode = output.exit
