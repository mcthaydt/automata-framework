// Run the scope codemod over the whole repository:
//   node tooling/codemods/src/rename-scope-cli.ts [--dry-run]
// It rewrites every tracked text file outside the history (rename-scope.ts says what stays), prints how many files
// changed, and lists the files whose regular expressions encode the old names for a person to check by eye.
// Then run `pnpm install` (the lockfile names the packages) and regenerate the API reports and agent skills.
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { hasPatternForm, keepsOldNames, renameScope } from '#src/rename-scope.ts'

const { values } = parseArgs({ options: { 'dry-run': { type: 'boolean', default: false } } })

const root = resolve(execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim())
// `git grep -l -I` lists only tracked text files (binaries skipped) that name the old scope at all.
const candidates = execFileSync('git', ['grep', '-l', '-I', '-z', 'mcthaydt'], {
  encoding: 'utf8',
  cwd: root,
})
  .split('\0')
  .filter((path) => path !== '' && !keepsOldNames(path))

const changed: string[] = []
const checkByEye: string[] = []
for (const path of candidates) {
  const file = resolve(root, path)
  const before = readFileSync(file, 'utf8')
  const after = renameScope(before)
  if (after === before) continue
  changed.push(path)
  if (hasPatternForm(before)) checkByEye.push(path)
  if (!values['dry-run']) writeFileSync(file, after)
}

console.log(`${values['dry-run'] ? 'would change' : 'changed'} ${changed.length} files`)
if (checkByEye.length > 0) console.log(`regular expressions to check by eye:\n  ${checkByEye.join('\n  ')}`)
