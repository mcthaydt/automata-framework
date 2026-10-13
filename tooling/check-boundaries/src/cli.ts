#!/usr/bin/env node
// Usage: node tooling/check-boundaries/src/cli.ts [--allow-import <specifier>]... <root> [<root>...]
// Each root is a sim source folder (packages/sim/src, a sim-plugin package, a game's sim folder). Checks
// every non-test source file under it, and that relative imports stay inside it; exits 1 on any finding.
// `--allow-import` adds an import specifier, by exact name, that every root in this run may use (see CheckOptions).
import { readFileSync } from 'node:fs'
import { relative } from 'node:path'
import { checkSource, type Finding } from './check.ts'
import { collectSources } from './files.ts'

const dirs: string[] = []
const allowImports: string[] = []
const args = process.argv.slice(2)
for (let i = 0; i < args.length; i++) {
  const arg = args[i] as string
  if (arg === '--allow-import') {
    const specifier = args[++i]
    if (specifier === undefined) {
      console.error('check-boundaries: --allow-import needs a specifier')
      process.exit(2)
    }
    allowImports.push(specifier)
  } else dirs.push(arg)
}
if (dirs.length === 0) {
  console.error('usage: check-boundaries [--allow-import <specifier>]... <dir> [<dir>...]')
  process.exit(2)
}
const files: string[] = []
const findings: Finding[] = []
for (const root of dirs) {
  for (const file of collectSources(root)) {
    files.push(file)
    findings.push(...checkSource(file, readFileSync(file, 'utf8'), { root, allowImports }))
  }
}
for (const f of findings)
  console.log(`${relative(process.cwd(), f.file)}:${f.line}:${f.col}  ${f.rule}  ${f.message}`)
console.log(`check-boundaries: ${files.length} files, ${findings.length} findings`)
process.exit(findings.length > 0 ? 1 : 0)
