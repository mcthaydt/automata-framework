// Usage: node tooling/check-style/src/cli.ts <package-src>... [--game <game-src>...]
// Checks every production .ts and .svelte file. Tests are exempt by folder: anything under a tests/ folder (where
// every moved package keeps them) or a testing/ folder (published test helpers). The *.test.ts and *.test.svelte
// suffixes stay exempt only until the 3D and editor packages move their tests (core and 2D refactor, phase 3). Svelte files get the QB.2 rules (no {@html}, no platform chrome); .ts files the naming rules. Roots after
// --game are a game's src/, where the sim may be grouped by role (GL spec §5.1).
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { checkFile, checkGameRoot, type StyleFinding } from './style.ts'
import { checkSvelte } from './svelte.ts'

function collect(dir: string, out: string[]): void {
  for (const name of readdirSync(dir).sort()) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) {
      if (name !== 'testing' && name !== 'tests') collect(path, out)
    } else if (name.endsWith('.ts') && !name.endsWith('.test.ts') && !name.endsWith('.d.ts')) out.push(path)
    else if (name.endsWith('.svelte') && !name.endsWith('.test.svelte')) out.push(path)
  }
}

const args = process.argv.slice(2)
const gameFlag = args.indexOf('--game')
const packageRoots = gameFlag === -1 ? args : args.slice(0, gameFlag)
const gameRoots = gameFlag === -1 ? [] : args.slice(gameFlag + 1)
if (packageRoots.length + gameRoots.length === 0) {
  console.error('usage: check-style <package-src>... [--game <game-src>...]')
  process.exit(2)
}

const files: { path: string; gameRoot?: string }[] = []
for (const root of packageRoots) {
  const paths: string[] = []
  collect(root, paths)
  files.push(...paths.map((path) => ({ path })))
}
for (const gameRoot of gameRoots) {
  const paths: string[] = []
  collect(gameRoot, paths)
  files.push(...paths.map((path) => ({ path, gameRoot })))
}
const findings: StyleFinding[] = [
  ...gameRoots.flatMap((root) => checkGameRoot(root)),
  ...files.flatMap(({ path, gameRoot }) =>
    path.endsWith('.svelte')
      ? checkSvelte(path, readFileSync(path, 'utf8'))
      : checkFile(path, readFileSync(path, 'utf8'), gameRoot === undefined ? {} : { gameRoot }),
  ),
]
for (const f of findings) {
  const where = f.line ? `${relative(process.cwd(), f.file)}:${f.line}` : relative(process.cwd(), f.file)
  console.log(`${where}  ${f.rule}  ${f.message}`)
}
console.log(`check-style: ${files.length} files, ${findings.length} findings`)
process.exit(findings.length > 0 ? 1 : 0)
