// Run the scope codemod over the whole repository:
//   node tooling/codemods/src/rename-scope-cli.ts [--dry-run]
// It rewrites every tracked text file outside the history (rename-scope.ts says what stays), formats the files it changed
// the way `pnpm format` does (a longer name can push an import past the line width), prints how many files and names
// changed, and lists the files whose regular expressions name the old scope for a person to check by eye. It reads
// only tracked files, so `node_modules`, `dist` and other build output are never touched, and it is deterministic and
// idempotent: a second run prints "changed 0 files".
// Then run `pnpm install` (it rewrites the lockfile) and the generators (`pnpm build`, `pnpm api-report --update`,
// `pnpm api-index --write`, `pnpm agent-skills`), which must agree with what the codemod wrote.
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { keepsOldNames, needsALook, oldNameCount, renameScope } from '#src/rename-scope.ts'

const { values } = parseArgs({ options: { 'dry-run': { type: 'boolean', default: false } } })

const root = resolve(execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim())
// `git grep -l -I` lists only tracked text files (binaries skipped) that hold the word at all; sorted, so the order
// (and the report) is the same on every machine.
const candidates = execFileSync('git', ['grep', '-l', '-I', '-z', 'automata'], {
  encoding: 'utf8',
  cwd: root,
  maxBuffer: 64 * 1024 * 1024,
})
  .split('\0')
  .filter((path) => path !== '' && !keepsOldNames(path))
  .sort()

const changed: string[] = []
const checkByEye: string[] = []
let names = 0
for (const path of candidates) {
  const file = resolve(root, path)
  const before = readFileSync(file, 'utf8')
  const after = renameScope(before)
  if (after === before) continue
  changed.push(path)
  names += oldNameCount(before)
  if (needsALook(before)) checkByEye.push(path)
  if (!values['dry-run']) writeFileSync(file, after)
}

// Biome is the repository's formatter; only the changed files are formatted, so the run edits nothing it did not rename.
if (!values['dry-run'] && changed.length > 0) {
  execFileSync('pnpm', ['exec', 'biome', 'check', '--write', '--no-errors-on-unmatched', ...changed], {
    cwd: root,
    stdio: ['ignore', 'ignore', 'inherit'],
  })
}

console.log(`${values['dry-run'] ? 'would change' : 'changed'} ${changed.length} files, ${names} names`)
if (checkByEye.length > 0) console.log(`regular expressions to check by eye:\n  ${checkByEye.join('\n  ')}`)
