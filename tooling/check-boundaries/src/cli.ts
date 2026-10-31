#!/usr/bin/env node
// Usage: node tooling/check-boundaries/src/cli.ts [--inline] [--allow-import <specifier>]... <root>... [--game <src>...]
// Each root is a sim source folder (packages/sim/src, a sim-plugin package, a game's sim folder). Checks
// every non-test source file under it, and that relative imports stay inside it; exits 1 on any finding.
// `--allow-import` adds an import specifier, by exact name, that every root in this run may use (see CheckOptions).
// `--inline` checks one-file examples instead (EX spec §4): each root is a file or a folder of browser files, and
// only the arguments of their `defineSystem` and `definePlugin` calls are checked.
// Roots after `--game` are a game's src/ laid out by role (GL spec §4.5): only its sim set is checked, and a value
// import from a sim file must stay inside that set. A game root with no sim files exits 2.
// `--platform-imports <root>...` runs only the platform check (DIST spec §5.1): every source under each root, tests
// included, imports a target's platform packages (`@ruken/*`, `@tauri-apps/*`) only under that target's folder.
import { readFileSync, statSync } from 'node:fs'
import { relative, resolve } from 'node:path'
import { checkSource, type Finding } from './check.ts'
import { collectGameSimSet, collectSources, GAME_SIM_ROLES } from './files.ts'
import { collectPlatformSources, platformImportFindings } from './platform-imports.ts'

/** Prints the findings and the count, then exits 1 when there are any. */
function finish(files: readonly string[], findings: readonly Finding[]): never {
  for (const f of findings)
    console.log(`${relative(process.cwd(), f.file)}:${f.line}:${f.col}  ${f.rule}  ${f.message}`)
  console.log(`check-boundaries: ${files.length} files, ${findings.length} findings`)
  process.exit(findings.length > 0 ? 1 : 0)
}

if (process.argv[2] === '--platform-imports') {
  const roots = process.argv.slice(3)
  if (roots.length === 0) {
    console.error('usage: check-boundaries --platform-imports <root>...')
    process.exit(2)
  }
  const files = roots.flatMap((root) =>
    statSync(root).isDirectory() ? collectPlatformSources(root) : [root],
  )
  finish(
    files,
    files.flatMap((file) => platformImportFindings(file, readFileSync(file, 'utf8'))),
  )
}

const dirs: string[] = []
const gameRoots: string[] = []
let afterGame = false
const allowImports: string[] = []
let inline = false
const args = process.argv.slice(2)
for (let i = 0; i < args.length; i++) {
  const arg = args[i] as string
  if (arg === '--inline') inline = true
  else if (arg === '--game') afterGame = true
  else if (arg === '--allow-import') {
    const specifier = args[++i]
    if (specifier === undefined) {
      console.error('check-boundaries: --allow-import needs a specifier')
      process.exit(2)
    }
    allowImports.push(specifier)
  } else if (afterGame) gameRoots.push(arg)
  else dirs.push(arg)
}
if (dirs.length + gameRoots.length === 0) {
  console.error(
    'usage: check-boundaries [--inline] [--allow-import <specifier>]... <dir>... [--game <src>...]',
  )
  process.exit(2)
}
const files: string[] = []
const findings: Finding[] = []
for (const root of dirs) {
  for (const file of statSync(root).isDirectory() ? collectSources(root) : [root]) {
    files.push(file)
    findings.push(...checkSource(file, readFileSync(file, 'utf8'), { root, allowImports, inline }))
  }
}
for (const root of gameRoots) {
  const simFiles = collectGameSimSet(root)
  if (simFiles.length === 0) {
    // An empty sim set is a misplaced root, not a clean sim (GL spec §5.2).
    const expected = [...GAME_SIM_ROLES, 'sim'].map((name) => `${name}.ts`).join(', ')
    console.error(`check-boundaries: no sim files in ${root} (${expected})`)
    process.exit(2)
  }
  const simSet = new Set(simFiles.map((file) => resolve(file)))
  for (const file of simFiles) {
    files.push(file)
    findings.push(...checkSource(file, readFileSync(file, 'utf8'), { root, allowImports, simSet }))
  }
}
finish(files, findings)
