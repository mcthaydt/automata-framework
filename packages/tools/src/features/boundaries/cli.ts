#!/usr/bin/env node
// Usage: automata-check-boundaries [--inline] [--allow-import <specifier>]... [--skip-dir <name>]... <root>... [--game <src>...]
// Each root is a sim source folder (packages/sim/src, a sim-plugin package, a game's sim folder). Checks
// every non-test source file under it, and that relative imports stay inside it; exits 1 on any finding.
// `--allow-import` adds an import specifier, by exact name, that every root in this run may use (see CheckOptions).
// `--skip-dir <name>` leaves out every folder of that name under the roots (the sim package's `testing`).
// `--inline` checks one-file examples instead: each root is a file or a folder of browser files, and
// only the arguments of their `defineSystem` and `definePlugin` calls are checked.
// Roots after `--game` are a game's src/ laid out by role: only its sim set is checked, and a value
// import from a sim file must stay inside that set. A game laid out by feature has its sim by role suffix and by
// import (`player-move.system.ts` and the files it imports). A game root with no sim files exits 2.
// `--platform-imports <root>...` runs only the platform check: every source under each root, tests
// included, imports a target's platform packages (`@ruken/*`, `@tauri-apps/*`) only under that target's folder.
// `--features <package-root>... [--shared-island <folder>] [--components]` runs only the feature-layout check:
// app/, features/<x>/, shared/, entries/ and testing/ of each package's src/ import one way. With
// `--shared-island kit`, shared/kit/ may import only itself and other packages. With `--components`, Svelte
// components are read too (the site's are; the editor's views still cross features, a finding for its audit).
// `--forbid <package-root>:<package>,<package>...` runs only the forbidden-import check: no source under the
// root (tests included) imports those packages, or a path inside them (`packages/editor:@pixi/3d`).
// `--browser <package-root>[:<entry>,<entry>]...` runs only the browser-only check: nothing a
// browser entry reaches imports Effect, a Node built-in or a Node-only library. The entries after `:` name files in
// src/entries/ (`packages/content:locale,assets`); with none, every file there is a browser entry.
import { readFileSync, statSync } from 'node:fs'
import { relative, resolve } from 'node:path'
import { browserOnlyFindings } from './browser-only.ts'
import { checkSource, type Finding } from './check.ts'
import { featureFindings } from './features.ts'
import { collectGameSimSet, collectSources, GAME_SIM_ROLES } from './files.ts'
import { forbidFindings } from './forbid.ts'
import { collectPlatformSources, platformImportFindings } from './platform-imports.ts'
import { collectSimBySuffix, SIM_SUFFIXES } from './sim-by-suffix.ts'

/** Prints the findings and the count, then exits 1 when there are any. */
function finish(files: readonly string[], findings: readonly Finding[]): never {
  for (const f of findings) {
    const where = `${relative(process.cwd(), f.file)}:${f.line}:${f.col}`
    // A message of several lines (the feature and browser rules) is printed under its location, indented.
    if (f.message.includes('\n')) console.log(`${where}\n${f.message.replace(/^/gm, '  ')}`)
    else console.log(`${where}  ${f.rule}  ${f.message}`)
  }
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

if (process.argv[2] === '--features' || process.argv[2] === '--browser' || process.argv[2] === '--forbid') {
  const mode = process.argv[2]
  // `--components` may come anywhere after `--features`.
  const components = mode === '--features' && process.argv.includes('--components')
  const args = process.argv.slice(3).filter((arg) => arg !== '--components')
  // `--shared-island <folder>` may follow the roots of `--features`.
  const islandAt = args.indexOf('--shared-island')
  const sharedIsland = islandAt === -1 ? undefined : args[islandAt + 1]
  if (islandAt !== -1 && (mode !== '--features' || sharedIsland === undefined)) {
    console.error(
      'usage: check-boundaries --features <package-root>... [--shared-island <folder>] [--components]',
    )
    process.exit(2)
  }
  const roots = islandAt === -1 ? args : args.slice(0, islandAt)
  if (roots.length === 0) {
    console.error(
      `usage: check-boundaries ${mode} <package-root>${mode === '--forbid' ? ':<package>,...' : ''}...`,
    )
    process.exit(2)
  }
  const files: string[] = []
  const findings: Finding[] = []
  for (const root of roots) {
    const [packageRoot = root, list] = root.split(':')
    const entries = list === undefined ? undefined : list.split(',')
    if (mode === '--forbid' && entries === undefined) {
      console.error(`check-boundaries: --forbid needs "${root}:<package>,<package>"`)
      process.exit(2)
    }
    const result =
      mode === '--features'
        ? featureFindings(packageRoot, sharedIsland, { components })
        : mode === '--forbid'
          ? forbidFindings(packageRoot, entries as string[])
          : browserOnlyFindings(packageRoot, entries)
    files.push(...result.files)
    findings.push(...result.findings)
  }
  finish(files, findings)
}

const dirs: string[] = []
const gameRoots: string[] = []
let afterGame = false
const allowImports: string[] = []
const skipDirs: string[] = []
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
  } else if (arg === '--skip-dir') {
    const name = args[++i]
    if (name === undefined) {
      console.error('check-boundaries: --skip-dir needs a folder name')
      process.exit(2)
    }
    skipDirs.push(name)
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
  for (const file of statSync(root).isDirectory() ? collectSources(root, skipDirs) : [root]) {
    files.push(file)
    findings.push(...checkSource(file, readFileSync(file, 'utf8'), { root, allowImports, inline }))
  }
}
for (const root of gameRoots) {
  // A game's sim is its role files (a game laid out by role) and its role-suffixed files with what they
  // import (a game laid out by feature); a game may have either, and both are checked as sim.
  const simFiles = [...new Set([...collectGameSimSet(root), ...collectSimBySuffix(root)])].sort()
  if (simFiles.length === 0) {
    // An empty sim set is a misplaced root, not a clean sim.
    const expected = [...GAME_SIM_ROLES, 'sim'].map((name) => `${name}.ts`).join(', ')
    console.error(
      `check-boundaries: no sim files in ${root} (${expected}, or files ending ${SIM_SUFFIXES.join(', ')})`,
    )
    process.exit(2)
  }
  const simSet = new Set(simFiles.map((file) => resolve(file)))
  for (const file of simFiles) {
    files.push(file)
    findings.push(...checkSource(file, readFileSync(file, 'utf8'), { root, allowImports, simSet }))
  }
}
finish(files, findings)
