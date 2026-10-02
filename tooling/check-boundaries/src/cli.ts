// Usage: node tooling/check-boundaries/src/cli.ts <dir> [<dir>...]
// Checks every non-test .ts file under each directory; exits 1 on any finding.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { checkSource, type Finding } from './check.ts'

function collect(dir: string, out: string[]): void {
  for (const name of readdirSync(dir).sort()) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) collect(path, out)
    else if (name.endsWith('.ts') && !name.endsWith('.test.ts') && !name.endsWith('.d.ts')) out.push(path)
  }
}

const dirs = process.argv.slice(2)
if (dirs.length === 0) {
  console.error('usage: check-boundaries <dir> [<dir>...]')
  process.exit(2)
}
const files: string[] = []
for (const d of dirs) collect(d, files)
const findings: Finding[] = files.flatMap((f) => checkSource(f, readFileSync(f, 'utf8')))
for (const f of findings)
  console.log(`${relative(process.cwd(), f.file)}:${f.line}:${f.col}  ${f.rule}  ${f.message}`)
console.log(`check-boundaries: ${files.length} files, ${findings.length} findings`)
process.exit(findings.length > 0 ? 1 : 0)
