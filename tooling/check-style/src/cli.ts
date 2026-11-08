// Usage: node tooling/check-style/src/cli.ts [--plan-comments] <package-src>... [--role-layout <game-src>...] [--comments-only <root>...] [--test-imports <root>...] [--tokens <kit-folder> <root>...]
// --plan-comments also flags comments that cite a milestone, task id or spec section (opt-in, for the roots passed).
// Checks every production .ts and .svelte file (and, with --plan-comments, .css comments). Tests are exempt by folder: anything under a tests/ folder (where
// every moved package keeps them). A testing/ folder (published test helpers) ships, so its comments are read under
// --plan-comments, but it has no naming or markup rules. The *.test.ts and *.test.svelte
// suffixes stay exempt only until the 3D and editor packages move their tests. Svelte files get the markup rules (no {@html}, no platform chrome);.ts files the naming rules. Roots after
// --role-layout are a game's src/ laid out by role: only games/base-3d, until the 3D phase. A game laid out by feature is a package root.
// `--docs` (alone, from the repository root) reads the tracked Markdown, YAML and .npmrc instead: plan IDs in their
// prose and comments, and relative links that lead nowhere (src/docs.ts).
import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { checksLinks, checksPlanIds, docPlanIdFindings, linkFindings } from './docs.ts'
import { planCommentFindings } from './plan-comments.ts'
import { checkFile, checkGameRoot, type StyleFinding } from './style.ts'
import { checkSvelte } from './svelte.ts'
import { testImportFindings } from './test-imports.ts'
import { definedTokens, findUnknownTokens } from './tokens.ts'

/** Tests are exempt; the rest are build output and dependencies, which no one wrote by hand. */
const SKIPPED_FOLDERS: ReadonlySet<string> = new Set([
  'tests',
  'node_modules',
  'dist',
  '.turbo',
  '.svelte-kit',
])

/** Published test helpers: they ship, so their comments are read, but no other rule applies to them. */
const isTestHelper = (path: string): boolean => path.split(sep).includes('testing')

function collect(dir: string, out: string[]): void {
  for (const name of readdirSync(dir).sort()) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) {
      if (!SKIPPED_FOLDERS.has(name)) collect(path, out)
    } else if (name.endsWith('.ts') && !name.endsWith('.test.ts') && !name.endsWith('.d.ts')) out.push(path)
    else if (name.endsWith('.css')) out.push(path)
    else if (name.endsWith('.svelte') && !name.endsWith('.test.svelte')) out.push(path)
  }
}

/** Prints the findings and exits: 1 with findings, 0 without. */
function report(findings: readonly StyleFinding[], fileCount: number): never {
  for (const f of findings) {
    const where = f.line ? `${relative(process.cwd(), f.file)}:${f.line}` : relative(process.cwd(), f.file)
    console.log(`${where}  ${f.rule}  ${f.message}`)
  }
  console.log(`check-style: ${fileCount} files, ${findings.length} findings`)
  process.exit(findings.length > 0 ? 1 : 0)
}

if (process.argv.includes('--docs')) {
  // Tracked files only: what is ignored is nobody's text.
  const tracked = execFileSync('git', ['ls-files', '*.md', '*.yml', '*.yaml', '.npmrc'], { encoding: 'utf8' })
    .split('\n')
    .filter((file) => file !== '' && existsSync(file))
  const docs = tracked.filter((file) => checksPlanIds(file) || checksLinks(file))
  report(
    docs.flatMap((file) => {
      const text = readFileSync(file, 'utf8')
      return [
        ...(checksPlanIds(file) ? docPlanIdFindings(file, text) : []),
        ...(checksLinks(file) ? linkFindings(file, text, existsSync) : []),
      ]
    }),
    docs.length,
  )
}

const planComments = process.argv.includes('--plan-comments')

// Roots come in three groups: package roots first, then `--role-layout` roots (a game's src/, laid out by role), then
// `--comments-only` roots (config files, scripts and apps that have no naming rules, where only plan comments are read).
const packageRoots: string[] = []
const gameRoots: string[] = []
const commentRoots: string[] = []
const testRoots: string[] = []
const tokenArgs: string[] = []
let group = packageRoots
for (const arg of process.argv.slice(2)) {
  if (arg === '--plan-comments') continue
  if (arg === '--role-layout') group = gameRoots
  else if (arg === '--comments-only') group = commentRoots
  else if (arg === '--test-imports') group = testRoots
  else if (arg === '--tokens') group = tokenArgs
  else group.push(arg)
}
if (
  packageRoots.length + gameRoots.length + commentRoots.length + testRoots.length + tokenArgs.length ===
  0
) {
  console.error(
    'usage: check-style [--plan-comments] <package-src>... [--role-layout <game-src>...] [--comments-only <root>...] [--test-imports <root>...] [--tokens <kit-folder> <root>...]',
  )
  process.exit(2)
}

const files: { path: string; gameRoot?: string; commentsOnly?: true }[] = []
const seen = new Set<string>()
function add(
  roots: readonly string[],
  extra: { gameRoot?: string; commentsOnly?: true },
  own: boolean,
): void {
  for (const root of roots) {
    const paths: string[] = []
    collect(root, paths)
    for (const path of paths) {
      // A file a stricter root already reads is not read again by a comments-only root.
      if (seen.has(path)) continue
      seen.add(path)
      files.push({
        path,
        ...(own ? { gameRoot: root } : {}),
        ...(extra.commentsOnly || isTestHelper(relative(root, path)) ? { commentsOnly: true as const } : {}),
      })
    }
  }
}
add(packageRoots, {}, false)
add(gameRoots, {}, true)
add(commentRoots, { commentsOnly: true }, false)

/** The findings for one file; a stylesheet has no naming or markup rules, so only its comments are read. */
function findingsFor(path: string, gameRoot: string | undefined, commentsOnly: boolean): StyleFinding[] {
  const code = readFileSync(path, 'utf8')
  const plan = planComments ? planCommentFindings(path, code) : []
  if (commentsOnly || path.endsWith('.css')) return plan
  if (path.endsWith('.svelte')) return [...checkSvelte(path, code), ...plan]
  return checkFile(path, code, { ...(gameRoot === undefined ? {} : { gameRoot }), planComments })
}

/** Every test file under a `tests/` folder of the roots passed to `--test-imports`. */
function collectTests(dir: string, inTests: boolean, out: string[]): void {
  for (const name of readdirSync(dir).sort()) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) {
      if (name !== 'node_modules' && name !== 'dist') collectTests(path, inTests || name === 'tests', out)
    } else if (inTests && /\.(ts|svelte)$/.test(name)) out.push(path)
  }
}
const testFiles: string[] = []
for (const root of testRoots) collectTests(root, false, testFiles)

/** Stylesheets and components under a root: where a custom property is defined or used. */
function collectStyled(dir: string, out: string[]): void {
  for (const name of readdirSync(dir).sort()) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) {
      if (!SKIPPED_FOLDERS.has(name)) collectStyled(path, out)
    } else if (/\.(css|svelte)$/.test(name) && !name.endsWith('.test.svelte')) out.push(path)
  }
}
// `--tokens <kit-folder> <root>...`: the kit folder says which names are tokens (every name its stylesheets and
// components define, the shell's `style:--dock-lift` too); each root's files may use those and any a root defines.
const [tokenKit, ...tokenRoots] = tokenArgs
const tokenFindings: StyleFinding[] = []
let tokenFileCount = 0
if (tokenKit !== undefined) {
  const kitFiles: string[] = []
  collectStyled(tokenKit, kitFiles)
  const used: string[] = []
  for (const root of tokenRoots) collectStyled(root, used)
  // A property one component sets for the ones inside it (`--plan-foot`) is the package's own, not a missing token.
  const known = new Set(
    [...kitFiles, ...used].flatMap((path) => [...definedTokens(readFileSync(path, 'utf8'))]),
  )
  tokenFileCount = used.length
  for (const path of used) tokenFindings.push(...findUnknownTokens(path, readFileSync(path, 'utf8'), known))
}

const findings: StyleFinding[] = [
  ...tokenFindings,
  ...gameRoots.flatMap((root) => checkGameRoot(root)),
  ...files.flatMap(({ path, gameRoot, commentsOnly }) => findingsFor(path, gameRoot, commentsOnly === true)),
  ...testFiles.flatMap((path) => testImportFindings(path, readFileSync(path, 'utf8'))),
]
report(findings, files.length + testFiles.length + tokenFileCount)
