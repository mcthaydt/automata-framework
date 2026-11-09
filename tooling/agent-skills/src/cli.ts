// Usage: node tooling/agent-skills/src/cli.ts [--root <dir>]
// Checks AF's agent package (agents/automata and the root marketplace): every skill, the hook and the manifests in
// place. The automata-api skill's `reference/api.md` and the plugin version are the API index's outputs
// (`pnpm api-index`, which checks them, and `--write`, which writes them). Exit 0 good, 1 a layout problem.
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readAgentPackage } from './layout.ts'

export interface CliIo {
  readonly stdout: (message: string) => void
  readonly stderr: (message: string) => void
}

const REPO = resolve(import.meta.dirname, '../../..')

export function runAgentSkills(args: readonly string[], io: CliIo): number {
  const rootIndex = args.indexOf('--root')
  const root = rootIndex >= 0 ? resolve(args[rootIndex + 1] ?? '.') : REPO

  const { problems, skills } = readAgentPackage(root)
  for (const problem of problems) io.stderr(`${problem}\n`)
  if (problems.length > 0) return 1
  io.stdout(`agent package: ${skills.length} skills, no layout problems\n`)
  return 0
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = runAgentSkills(process.argv.slice(2), {
    stdout: (message) => process.stdout.write(message),
    stderr: (message) => process.stderr.write(message),
  })
}
