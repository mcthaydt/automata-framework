// Usage: node tooling/repo-hygiene/src/prune-branches-cli.ts [--apply] [--list docs/refactor/branches.md]
//   (the root `pnpm branches:prune`)
//
// Without --apply this is a dry run: it checks every branch in the list against origin and prints what it would do.
// With --apply it tags and deletes. Branch deletion is the Owner's call (AGENTS.md): run --apply only on their go.
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseBranches, prune } from './prune-branches.ts'

const root = fileURLToPath(new URL('../../..', import.meta.url))
const argv = process.argv.slice(2)
const apply = argv.includes('--apply')
const listPath = argv.includes('--list')
  ? (argv[argv.indexOf('--list') + 1] ?? '')
  : 'docs/refactor/branches.md'

const git = (...args: string[]): string => execFileSync('git', args, { cwd: root, encoding: 'utf8' })

try {
  const entries = parseBranches(readFileSync(join(root, listPath), 'utf8'))
  const lines = prune(entries, git, { apply })
  for (const line of lines) console.log(`${apply ? '' : 'would: '}${line.action.padEnd(14)} ${line.branch}`)
  const count = (action: string): number => lines.filter((line) => line.action === action).length
  console.log(
    `branches:prune: ${entries.length} listed, ${count('delete')} to delete, ${count('tag and delete')} to tag then delete, ${count('already gone')} already gone${apply ? '' : ' (dry run; --apply to act)'}`,
  )
} catch (error) {
  console.error(`branches:prune: ${error instanceof Error ? error.message : String(error)}`)
  process.exit(1)
}
