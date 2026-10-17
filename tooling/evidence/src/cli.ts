// Usage: pnpm evidence (runs every golden package's test:evidence, then this), or node tooling/evidence/src/cli.ts
// after them. Writes evidence.json and evidence.schema.json at the repository root (DX spec §3.10).
//
// Every value is read here from what the runs and the checkout left behind, never typed in:
// - the goldens' per-engine hashes from each package's `.evidence/goldens.json` (Vitest's JSON reporter);
// - the revision from GITHUB_SHA or git, and the run from GitHub Actions' variables;
// - the Playwright version each reporting package resolves;
// - the publishable packages' versions from their manifests, and whether each was released from git's tags.
// The parity job in ci.yml runs it on every push to `main` and uploads both files as the `evidence` artifact.
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { z } from 'zod'
import { publishablePackages, workspacePackages } from '../../release/src/publishable-packages.ts'
import {
  buildEvidence,
  goldensFromReports,
  packagesFromManifests,
  runFromEnv,
  type VitestJsonReport,
} from './collect.ts'
import { EvidenceSchema } from './evidence.schema.ts'

const REPORT = '.evidence/goldens.json'

const git = (root: string, ...args: string[]): string =>
  execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim()

const readJson = (path: string): unknown => JSON.parse(readFileSync(path, 'utf8'))

/** The folders of the packages that have a test:evidence script, each of which must have left its report. */
function reportingPackages(root: string): string[] {
  const dirs = workspacePackages(root)
    .filter((pkg) => {
      const manifest = readJson(join(root, pkg.dir, 'package.json')) as { scripts?: Record<string, string> }
      return manifest.scripts?.['test:evidence'] !== undefined
    })
    .map((pkg) => pkg.dir)
  for (const dir of dirs)
    if (!existsSync(join(root, dir, REPORT)))
      throw new Error(`${dir} has no ${REPORT}; run \`pnpm evidence\``)
  return dirs
}

/** The one Playwright version the reporting packages drove their browsers with. */
function playwrightVersion(root: string, dirs: readonly string[]): string {
  const versions = new Set(
    dirs.map((dir) => {
      const resolve = createRequire(join(root, dir, 'package.json')).resolve
      return (readJson(resolve('playwright/package.json')) as { version: string }).version
    }),
  )
  if (versions.size !== 1)
    throw new Error(`the golden packages use different Playwright versions: ${[...versions]}`)
  return [...versions][0] as string
}

function main(): void {
  const root = fileURLToPath(new URL('../../..', import.meta.url))
  const dirs = reportingPackages(root)
  const reports = dirs.map((dir) => readJson(join(root, dir, REPORT)) as VitestJsonReport)
  const evidence = buildEvidence({
    generatedAt: new Date(),
    revision: {
      sha: process.env.GITHUB_SHA ?? git(root, 'rev-parse', 'HEAD'),
      dirty: git(root, 'status', '--porcelain') !== '',
    },
    run: runFromEnv(process.env),
    playwright: playwrightVersion(root, dirs),
    goldens: goldensFromReports(reports, root),
    packages: packagesFromManifests(
      publishablePackages(root).map((pkg) => pkg.manifest),
      git(root, 'tag', '--list', '@mcthaydt/*').split('\n').filter(Boolean),
    ),
  })
  writeFileSync(join(root, 'evidence.json'), `${JSON.stringify(evidence, null, 2)}\n`)
  writeFileSync(
    join(root, 'evidence.schema.json'),
    `${JSON.stringify(z.toJSONSchema(EvidenceSchema), null, 2)}\n`,
  )
  const agreeing = evidence.goldens.filter((golden) => golden.enginesAgree).length
  console.log(
    `evidence.json: ${evidence.revision.sha.slice(0, 7)}${evidence.revision.dirty ? ' (dirty)' : ''}, ` +
      `${evidence.run.kind === 'ci' ? evidence.run.url : 'local run'}; ` +
      `${evidence.goldens.length} goldens (${agreeing} agree in all four engines), ` +
      `${evidence.packages.length} packages (${evidence.packages.filter((pkg) => pkg.released).length} released)`,
  )
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main()
