// Usage: node tooling/repo-hygiene/src/new-deps-cli.ts [--base origin/main]   (the root `pnpm deps:new`)
//
// Prints the new-dependency report for this checkout against where HEAD left --base (new-deps-base.ts), and
// appends it to the job summary when GITHUB_STEP_SUMMARY is set. Exits 1 when a new package or version is missing from its registry.
import { execFileSync } from 'node:child_process'
import { appendFileSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describeDependencies, formatReport, type Manifest, newDependencies } from './new-deps.ts'
import { newDepsBase } from './new-deps-base.ts'
import { scopeRegistries } from './new-deps-registries.ts'

const root = fileURLToPath(new URL('../../..', import.meta.url))
const argv = process.argv.slice(2)
const baseRef = argv.includes('--base') ? (argv[argv.indexOf('--base') + 1] ?? 'origin/main') : 'origin/main'

const git = (...args: string[]): string => execFileSync('git', args, { cwd: root, encoding: 'utf8' })
const base = newDepsBase(git, baseRef)

/** Workspace manifests only: fixtures are test inputs, never installed. */
const isManifest = (path: string): boolean =>
  (path === 'package.json' || path.endsWith('/package.json')) && !path.split('/').includes('fixtures')

const headManifests: Record<string, Manifest> = {}
for (const path of git('ls-files').split('\n').filter(isManifest)) {
  headManifests[path] = JSON.parse(readFileSync(join(root, path), 'utf8')) as Manifest
}
const baseManifests: Record<string, Manifest> = {}
for (const path of git('ls-tree', '-r', '--name-only', base).split('\n').filter(isManifest)) {
  baseManifests[path] = JSON.parse(git('show', `${base}:${path}`)) as Manifest
}

const reports = await describeDependencies(
  newDependencies(baseManifests, headManifests, scopeRegistries(root)),
  (url) => fetch(url),
)
const report = formatReport(
  reports,
  base === baseRef ? baseRef : `${baseRef} (merge base ${base.slice(0, 7)})`,
)
console.log(report)
const summary = process.env.GITHUB_STEP_SUMMARY
if (summary !== undefined && summary !== '') appendFileSync(summary, report)

const missing = reports.filter((each) => each.status === 'missing')
if (missing.length > 0) {
  console.error(
    `deps:new: not on its registry: ${missing.map((each) => `${each.name}@${each.version}`).join(', ')}`,
  )
  process.exit(1)
}
