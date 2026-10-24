// Usage: node tooling/agent-skills/src/cli.ts [--root <dir>] [--write]
// Checks AF's agent package (agents/automata and the root marketplace) and that the automata-api skill carries the
// generated API reference. Run after `pnpm build && pnpm api-index`. Exit 0 good (or written), 1 a layout problem
// or a stale reference, 2 no generated reference to compare with.
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { checkApiReference } from './api-reference.ts'
import { readAgentPackage } from './layout.ts'

export interface CliIo {
  readonly stdout: (message: string) => void
  readonly stderr: (message: string) => void
}

const REPO = resolve(import.meta.dirname, '../../..')

export function runAgentSkills(args: readonly string[], io: CliIo): number {
  const rootIndex = args.indexOf('--root')
  const root = rootIndex >= 0 ? resolve(args[rootIndex + 1] ?? '.') : REPO
  const write = args.includes('--write')

  const { problems, skills } = readAgentPackage(root)
  for (const problem of problems) io.stderr(`${problem}\n`)

  const api = checkApiReference(root, { write })
  const apiOk = api.status === 'in-sync' || api.status === 'written'
  ;(apiOk ? io.stdout : io.stderr)(`${api.message}\n`)
  if (problems.length === 0) io.stdout(`agent package: ${skills.length} skills, no layout problems\n`)

  if (api.status === 'missing-build') return 2
  return problems.length > 0 || !apiOk ? 1 : 0
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = runAgentSkills(process.argv.slice(2), {
    stdout: (message) => process.stdout.write(message),
    stderr: (message) => process.stderr.write(message),
  })
}
