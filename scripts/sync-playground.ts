import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { compileExample } from '../src/lib/playground/compile'
import { SITE_ORIGIN } from '../src/lib/site.js'
import { frameworkCommit } from './framework-source'

// The playground modules the framework owns and the site uses unchanged (spec §4, §5.1, §11.3): copied verbatim
// from the framework checkout beside the site, each under a first line naming the commit, never edited by hand.
// tests/playground-sync.test.ts fails when a copy differs from the framework file at framework.ref.

const __dirname = dirname(fileURLToPath(import.meta.url))
const frameworkDir = resolve(__dirname, '../../automata-framework')
const websiteDir = resolve(__dirname, '..')

export const PLAYGROUND_COPIES = [
  { from: 'tooling/examples-runner/src/playground/playground-protocol.ts', to: 'src/lib/playground/protocol.ts' },
  { from: 'tooling/examples-runner/src/playground/playground-headers.ts', to: 'src/lib/playground/headers.ts' },
] as const

/** The first line of a copy, naming where it came from. */
export function copyHeader(commit: string, from: string): string {
  return `// Copied from automata-framework ${commit}:${from} by scripts/sync-playground.ts. Do not edit; run pnpm sync.`
}

export function syncPlaygroundCopies(commit: string): void {
  for (const { from, to } of PLAYGROUND_COPIES) {
    const text = readFileSync(join(frameworkDir, from), 'utf8')
    writeFileSync(join(websiteDir, to), `${copyHeader(commit, from)}\n${text}`)
  }
}

/** What `import.meta.url` becomes in an example (spec §5.2): its module path under the site's origin. */
export function moduleUrlFor(example: { moduleUrl: string }): string {
  return new URL(example.moduleUrl, SITE_ORIGIN).href
}

// The files the site writes into the tree itself, which the framework's manifest does not list.
const SITE_WRITTEN = ['manifest.json', 'compiled/']

/**
 * Checks a build:playground tree against its manifest.json (spec §5.5): the commit, then every file listed with its
 * sha256 and nothing unlisted. Returns one message per problem; an empty list means it matches.
 */
export function verifyPlaygroundTree(dir: string, commit: string): string[] {
  const manifest = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8')) as { framework: string; files: { path: string; sha256: string }[] }
  if (manifest.framework !== commit) return [`manifest.json names framework ${manifest.framework}, not ${commit}`]
  const problems: string[] = []
  const listed = new Set<string>()
  for (const { path, sha256 } of manifest.files) {
    listed.add(path)
    const file = join(dir, path)
    if (!existsSync(file)) problems.push(`${path} is listed but missing`)
    else if (createHash('sha256').update(readFileSync(file)).digest('hex') !== sha256) problems.push(`${path} does not match its sha256`)
  }
  const present = readdirSync(dir, { recursive: true, encoding: 'utf8' })
    .filter(name => statSync(join(dir, name)).isFile())
    .map(name => relative(dir, join(dir, name)).split(sep).join('/'))
    .filter(path => !SITE_WRITTEN.some(prefix => prefix.endsWith('/') ? path.startsWith(prefix) : path === prefix))
    .sort()
  for (const path of present) if (!listed.has(path)) problems.push(`${path} is not listed in manifest.json`)
  return problems
}

/**
 * Builds the framework's playground for the site's origin, checks it against its manifest, and publishes it to
 * static/playground/ with the precompiled originals (compiled/<id>.js, so the first run needs no compiler) and
 * src/data/examples.json. The build goes to a scratch folder: the framework checkout stays clean.
 */
export function syncPlaygroundTree(commit: string): number {
  const scratch = mkdtempSync(join(tmpdir(), 'af-playground-'))
  const built = join(scratch, 'dist-playground')
  try {
    execFileSync('node', ['playground/build-playground.ts', '--site-origin', SITE_ORIGIN, '--out', built], {
      cwd: join(frameworkDir, 'tooling/examples-runner'),
      stdio: ['ignore', 'ignore', 'inherit'],
    })
    const problems = verifyPlaygroundTree(built, commit)
    if (problems.length) throw new Error(`the playground build does not match its manifest:\n${problems.join('\n')}`)
    const catalog = JSON.parse(readFileSync(join(built, 'catalog.json'), 'utf8')) as { id: string; source: string; moduleUrl: string }[]
    mkdirSync(join(built, 'compiled'))
    for (const example of catalog) {
      const result = compileExample(example.source, { id: example.id, moduleUrl: moduleUrlFor(example) })
      if (!result.ok) throw new Error(`${example.id} does not compile: ${result.diagnostics.map(d => `${d.line}:${d.column} ${d.message}`).join('; ')}`)
      writeFileSync(join(built, 'compiled', `${example.id}.js`), result.code)
    }
    const target = join(websiteDir, 'static/playground')
    rmSync(target, { recursive: true, force: true })
    cpSync(built, target, { recursive: true })
    writeFileSync(join(websiteDir, 'src/data/examples.json'), `${JSON.stringify(catalog, null, 2)}\n`)
    return catalog.length
  } finally {
    rmSync(scratch, { recursive: true, force: true })
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const commit = frameworkCommit(frameworkDir)
  syncPlaygroundCopies(commit)
  const examples = syncPlaygroundTree(commit)
  console.log(`Copied the playground protocol and headers, and published the playground (${examples} examples), from framework ${commit.slice(0, 7)}.`)
}
