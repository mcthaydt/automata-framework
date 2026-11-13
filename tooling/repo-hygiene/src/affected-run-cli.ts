// Usage: node tooling/repo-hygiene/src/affected-run-cli.ts [--list] <task> [turbo flags] [-- <task runner arguments>]
//   (`pnpm test:unit:affected`, `pnpm test:e2e:affected --filter <package>`: a pull request's unit tests and journeys)
//
// Runs `<task>` in the packages the change affects, dependents included, and says which. The change is the one turbo
// reads: HEAD against the merge base, or TURBO_SCM_BASE..TURBO_SCM_HEAD when set (the workflow sets both). When no
// package is left it prints that the step was skipped and exits 0: turbo itself exits 0 in silence, which reads like a
// pass. `--list` prints the packages and runs nothing, to see what a change would run. The decision that a change turbo cannot place in a package (the lockfile, a workflow) runs everything is made
// before this runs (the `scope` step of .github/workflows/ci.yml), by calling the full script instead.
import { execFileSync, spawnSync } from 'node:child_process'
import { affectedPackages, type DryRun, skipNotice, turboArgs } from './affected-run.ts'

const argv = process.argv.slice(2)
const listOnly = argv[0] === '--list'
if (listOnly) argv.shift()
const task = argv[0]
if (task === undefined || task.startsWith('-')) {
  console.error('usage: affected-run-cli.ts [--list] <task> [turbo flags] [-- <task runner arguments>]')
  process.exit(2)
}
const rest = argv.slice(1)
const separator = rest.indexOf('--')
const filters = separator === -1 ? rest : rest.slice(0, separator)
const runnerArgs = separator === -1 ? [] : rest.slice(separator + 1)

// The dry run takes no runner arguments: they would follow `--`, and so would `--dry=json`, which the runner then gets.
const listing = execFileSync('pnpm', ['exec', 'turbo', ...turboArgs(task, [...filters, '--dry=json'], [])], {
  encoding: 'utf8',
  maxBuffer: 256 * 1024 * 1024,
  stdio: ['ignore', 'pipe', 'inherit'],
})
const packages = affectedPackages(JSON.parse(listing.slice(listing.indexOf('{'))) as DryRun, task)

if (packages.length === 0) {
  console.log(skipNotice(task))
  process.exit(0)
}
console.log(
  `affected ${task}: ${packages.length} package${packages.length === 1 ? '' : 's'}\n  ${packages.join('\n  ')}`,
)
if (listOnly) process.exit(0)
const done = spawnSync('pnpm', ['exec', 'turbo', ...turboArgs(task, filters, runnerArgs)], {
  stdio: 'inherit',
})
process.exit(done.status ?? 1)
