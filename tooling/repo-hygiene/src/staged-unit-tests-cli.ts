// Usage: node tooling/repo-hygiene/src/staged-unit-tests-cli.ts [-- <test runner arguments>]
//   (the commit hook's unit tests, lefthook.yml)
//
// Runs `test:unit` in the packages that own the staged files, and in no other: dependents are the job of `pnpm check`
// and the pull-request gate. It reads the index, not the working tree, so the same commit always selects the same
// packages. A commit that stages no file inside a package (the root files, the docs) runs no unit tests.
import { execFileSync, spawnSync } from 'node:child_process'
import { owningPackages } from './staged-packages.ts'

const argv = process.argv.slice(2)
const separator = argv.indexOf('--')
const runnerArgs = separator === -1 ? [] : argv.slice(separator + 1)

/** The workspace packages' folders, from turbo itself, so a filter always names a package turbo knows. */
function packageDirs(): string[] {
  const listing = execFileSync('pnpm', ['exec', 'turbo', 'ls', '--output=json'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
  })
  const json = JSON.parse(listing.slice(listing.indexOf('{'))) as { packages: { items: { path: string }[] } }
  return json.packages.items.map((item) => item.path)
}

const staged = execFileSync('git', ['diff', '--cached', '--name-only', '-z'], { encoding: 'utf8' })
  .split('\0')
  .filter((file) => file !== '')
const owners = owningPackages(staged, packageDirs())

if (owners.length === 0) {
  console.log('staged unit tests: no staged file is inside a package, so no unit tests run')
  process.exit(0)
}
console.log(`staged unit tests: ${owners.join(', ')}`)
const done = spawnSync(
  'pnpm',
  ['exec', 'turbo', 'run', 'test:unit', ...owners.map((dir) => `--filter=./${dir}`), '--', ...runnerArgs],
  { stdio: 'inherit' },
)
process.exit(done.status ?? 1)
