// Usage: pnpm sources-md [--complete]. Checks docs/provenance/sources.md against docs/provenance/builders-manifest.json
// (src/sources-md.ts). `--complete` also fails on a builder file that has no row.
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { checkSources, type Manifest } from './sources-md.ts'

const root = fileURLToPath(new URL('../../..', import.meta.url))
const md = readFileSync(join(root, 'docs/provenance/sources.md'), 'utf8')
const manifest = JSON.parse(
  readFileSync(join(root, 'docs/provenance/builders-manifest.json'), 'utf8'),
) as Manifest
const problems = checkSources(md, manifest, {
  complete: process.argv.includes('--complete'),
  exists: (path) => existsSync(join(root, path)),
})
for (const problem of problems) console.error(problem)
console.log(`sources-md: ${problems.length} findings`)
process.exitCode = problems.length > 0 ? 1 : 0
