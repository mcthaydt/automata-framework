#!/usr/bin/env node
import { FilesLive, ProcessRunnerLive } from '@mcthaydt/automata-node'
import { Effect, Layer } from 'effect'
import type { CommandOutput } from '../command-output.ts'
import { promoteEvidence } from '../promote-evidence.ts'

// The `promote-evidence` bin, run by Node from source (imports keep `.ts`; plan DT-D5). Dev-only: the package exports
// nothing a game could import (plan DT-a).

const USAGE = `usage: promote-evidence --to <baselines> [--from <dir>] [<path> …]
  With no path, lists each file under <dir> (default: evidence) that is new or changed against <baselines>, and
  copies nothing. With paths (files or set folders, relative to <dir>), copies them into <baselines>.
  Every path is checked first: one outside <dir>, not in it, or an evidence.json from a dirty tree or with
  disagreeing engines refuses the whole promotion (exit 2).
`

function parse(argv: readonly string[]): CommandOutput | { from: string; to: string; paths: string[] } {
  const usageError = (message: string): CommandOutput => ({
    exit: 2,
    stdout: '',
    stderr: `promote-evidence: ${message}; see --help\n`,
  })
  let from = 'evidence'
  let to: string | undefined
  const paths: string[] = []
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index] as string
    if (arg === '--help' || arg === '-h') return { exit: 0, stdout: USAGE, stderr: '' }
    if (arg === '--to' || arg === '--from') {
      const value = argv[++index]
      if (value === undefined || value.startsWith('--')) return usageError(`${arg} needs a folder`)
      if (arg === '--to') to = value
      else from = value
    } else if (arg.startsWith('-')) return usageError(`unknown option '${arg}'`)
    else paths.push(arg)
  }
  if (to === undefined) return usageError('--to <baselines> is required')
  return { from, to, paths }
}

const parsed = parse(process.argv.slice(2))
const output =
  'exit' in parsed
    ? parsed
    : await Effect.runPromise(
        promoteEvidence({ cwd: process.cwd(), ...parsed }).pipe(
          Effect.provide(Layer.merge(FilesLive, ProcessRunnerLive)),
        ),
      )
process.stdout.write(output.stdout)
process.stderr.write(output.stderr)
process.exitCode = output.exit
