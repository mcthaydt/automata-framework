// Usage: node tooling/agent-skills/src/mirror-cli.ts --out <dir> [--repo <dir>]
// Writes the public mirror tree (the plugin, its marketplace file, a README and the licence) into `<dir>`, which must
// be empty or hold only `.git`. The release job runs it on a clone of `mcthaydt/automata-skills`; `plugin:validate` runs
// it into `.mirror/`. Exit 0 written, 1 the folder holds other files, 2 the agent package is missing.
import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { MirrorError, writeMirror } from './mirror.ts'

const args = process.argv.slice(2)
const argAfter = (flag: string): string | undefined => args[args.indexOf(flag) + 1]
const out = args.includes('--out') ? argAfter('--out') : undefined
if (out === undefined) {
  process.stderr.write('Usage: mirror-cli.ts --out <dir> [--repo <dir>]\n')
  process.exit(2)
}
const repo = resolve(
  args.includes('--repo') ? (argAfter('--repo') ?? '.') : join(import.meta.dirname, '../../..'),
)

if (!existsSync(join(repo, 'agents/automata'))) {
  process.stderr.write(`No agent package at ${join(repo, 'agents/automata')}\n`)
  process.exit(2)
}
try {
  for (const path of writeMirror({ repo, out: resolve(out) })) process.stdout.write(`${path}\n`)
} catch (error) {
  if (!(error instanceof MirrorError)) throw error
  process.stderr.write(`${error.message}\n`)
  process.exit(1)
}
