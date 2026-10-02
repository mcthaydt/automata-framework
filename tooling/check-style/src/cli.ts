// Usage: node tooling/check-style/src/cli.ts <src-dir> [<src-dir>...]
// Checks every production .ts file (not *.test.ts, *.d.ts, or anything under a testing/ folder).
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { checkFile, type StyleFinding } from './style.ts'

function collect(dir: string, out: string[]): void {
  for (const name of readdirSync(dir).sort()) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) {
      if (name !== 'testing') collect(path, out)
    } else if (name.endsWith('.ts') && !name.endsWith('.test.ts') && !name.endsWith('.d.ts')) out.push(path)
  }
}

const dirs = process.argv.slice(2)
if (dirs.length === 0) {
  console.error('usage: check-style <src-dir> [<src-dir>...]')
  process.exit(2)
}
const files: string[] = []
for (const d of dirs) collect(d, files)
const findings: StyleFinding[] = files.flatMap((f) => checkFile(f, readFileSync(f, 'utf8')))
for (const f of findings) console.log(`${relative(process.cwd(), f.file)}  ${f.rule}  ${f.message}`)
console.log(`check-style: ${files.length} files, ${findings.length} findings`)
process.exit(findings.length > 0 ? 1 : 0)
