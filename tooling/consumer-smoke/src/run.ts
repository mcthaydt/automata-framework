// Usage: node tooling/consumer-smoke/src/run.ts --from packs|registry [--version 0.0.n] [--keep]
//
// Installs AF's published packages into a project outside the workspace and uses them as a game would. `packs` packs the workspace's built packages (run `pnpm build` first); `registry` installs a
// published version from npmjs.org (public: no token). Each check is a named step;
// the run exits 0 only if every step passed, and removes its temp folder unless --keep.
import { execFileSync } from 'node:child_process'
import {
  cpSync,
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { findRukenSdkMarkers } from '../../../packages/automata/src/features/targets/sdk-markers.ts'
import { publishablePackages } from '../../release/src/publishable-packages.ts'
import { bootGame } from './boot-game.ts'
import { packAll, sh } from './commands.ts'
import { fetchEditorPage } from './editor.ts'
import { type ConsumerPackage, consumerManifest, consumerWorkspace, type ToolVersions } from './project.ts'
import { readmeCommands, readWorkspace, unresolvedCommands } from './readme.ts'
import { rukenHeaders } from './ruken/ruken-headers.ts'
import { serveStatic } from './serve.ts'

const root = fileURLToPath(new URL('../../..', import.meta.url))
const fixtures = fileURLToPath(new URL('../fixtures/', import.meta.url))

interface Args {
  readonly from: 'packs' | 'registry'
  readonly version: string | undefined
  readonly keep: boolean
}

function parseArgs(argv: readonly string[]): Args {
  const value = (flag: string): string | undefined => {
    const index = argv.indexOf(flag)
    return index === -1 ? undefined : argv[index + 1]
  }
  const from = value('--from')
  if (from !== 'packs' && from !== 'registry') {
    throw new Error('usage: consumer-smoke --from packs|registry [--version 0.0.n] [--keep]')
  }
  const version = value('--version')
  if (from === 'registry' && version === undefined) throw new Error('--from registry needs --version')
  return { from, version, keep: argv.includes('--keep') }
}

const manifestOf = (dir: string) =>
  JSON.parse(readFileSync(join(root, dir, 'package.json'), 'utf8')) as {
    dependencies?: Record<string, string>
    devDependencies?: Record<string, string>
    packageManager?: string
  }

/** The workspace's pnpm. Without it, corepack may run a newer pnpm that ignores the project's overrides. */
function rootPackageManager(): string {
  const found = manifestOf('.').packageManager
  if (found === undefined) throw new Error('the workspace package.json has no packageManager')
  return found
}

/** The same pins the workspace uses (docs/versions.md), so the smoke project never drifts from them. */
function toolVersions(): ToolVersions {
  const rootManifest = manifestOf('.')
  const browser = manifestOf('packages/automata')
  const pin = (found: string | undefined, name: string): string => {
    if (found === undefined) throw new Error(`no workspace pin for ${name}`)
    return found
  }
  return {
    typescript: pin(rootManifest.devDependencies?.typescript, 'typescript'),
    typescript6: pin(browser.devDependencies?.typescript, 'typescript 6'),
    vite: pin(browser.devDependencies?.vite, 'vite'),
    svelte: pin(browser.devDependencies?.svelte, 'svelte'),
    vitePluginSvelte: pin(
      browser.devDependencies?.['@sveltejs/vite-plugin-svelte'],
      '@sveltejs/vite-plugin-svelte',
    ),
    zod: pin(manifestOf('packages/sim').dependencies?.zod, 'zod'),
    typesNode: pin(manifestOf('packages/tools').devDependencies?.['@types/node'], '@types/node'),
    pixi: pin(browser.devDependencies?.['pixi.js'], 'pixi.js'),
  }
}

/** Everything a command printed, whatever its exit code. */
function output(cwd: string, command: string, args: readonly string[]): string {
  try {
    return execFileSync(command, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
  } catch (error) {
    const failed = error as { stdout?: string; stderr?: string }
    return `${failed.stdout ?? ''}${failed.stderr ?? ''}`
  }
}

/** Exit code of a command expected to fail or pass, without throwing. */
function exitCode(cwd: string, command: string, args: readonly string[]): number {
  try {
    execFileSync(command, args, { cwd, stdio: 'ignore' })
    return 0
  } catch (error) {
    return (error as { status?: number }).status ?? -1
  }
}

function filesBelow(dir: string): string[] {
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name))
}

type Step = readonly [name: string, run: () => string | Promise<string>]

/** The most the packed `@automata/tools` (with the 2D editor inside) may weigh. */
const TOOLS_PACK_BUDGET_MB = 3

/** AF's own code must not need eval: Ruken's CSP has no 'unsafe-eval'. */
const EVAL = /\bnew Function\s*\(|(?<![.\w])eval\s*\(/

/** A string only Ruken's SDK has; a bundle with two SDK copies has it twice. */
const SDK_MARKER = '"ruken:__probe__"'

/** Every `.js` file of a Vite build, joined. */
const bundleCode = (dist: string): string =>
  filesBelow(dist)
    .filter((file) => file.endsWith('.js'))
    .map((file) => readFileSync(file, 'utf8'))
    .join('\n')

function steps(project: string): Step[] {
  const bin = (name: string) => join(project, 'node_modules/.bin', name)
  const installed = join(project, 'node_modules/@automata')
  return [
    [
      // The root README's clone-to-Emberwick and check commands still name real scripts and files.
      'readme: every command in the root README resolves',
      () => {
        const commands = readmeCommands(readFileSync(join(root, 'README.md'), 'utf8'))
        const problems = unresolvedCommands(commands, readWorkspace(root))
        if (problems.length > 0) throw new Error(problems.join('\n'))
        return `${commands.length} commands resolve`
      },
    ],
    ['node: import every entry, run a sim', () => sh(project, 'node', ['node-check.mjs']).trim()],
    [
      'content: compile a three-file content folder with the automata-content bin',
      () => {
        const out = sh(join(project, 'content'), bin('automata-content'), ['build']).trim()
        if (!existsSync(join(project, 'content/content/generated/content.json'))) {
          throw new Error(`automata-content build wrote no content.json\n${out}`)
        }
        return out
      },
    ],
    [
      'ship: automata ship --help prints its commands',
      () => {
        const usage = output(project, bin('automata'), ['ship', '--help'])
        if (!usage.includes('prepare') || !usage.includes('publish')) throw new Error(`no usage:\n${usage}`)
        return 'usage printed'
      },
    ],
    [
      // The editor is inside the tools package: the packed bin opens it with nothing else installed.
      'editor: the packed automata editor serves the 2D editor',
      () => fetchEditorPage(bin('automata'), join(project, 'content')),
    ],
    [
      // The editor makes the tools package bigger; this is the budget, so the growth is a decision and not an accident.
      `size: the packed -tools stays under ${TOOLS_PACK_BUDGET_MB} MB`,
      () => {
        // A registry run has no `packs` folder: nothing was packed, so there is nothing to measure.
        const packs = join(project, 'packs')
        const pack = existsSync(packs)
          ? readdirSync(packs).find((file) => /automata-tools-.*\.tgz$/.test(file))
          : undefined
        if (pack === undefined) return 'installed from the registry: not measured'
        const bytes = statSync(join(project, 'packs', pack)).size
        if (bytes > TOOLS_PACK_BUDGET_MB * 1024 * 1024)
          throw new Error(`${pack} is ${(bytes / 1024 / 1024).toFixed(2)} MB`)
        return `${pack} is ${Math.round(bytes / 1024)} kB`
      },
    ],
    [
      'boundaries: automata-check-boundaries passes a clean sim and fails a dirty one',
      () => {
        const clean = exitCode(project, bin('automata-check-boundaries'), ['boundaries/clean'])
        const dirty = exitCode(project, bin('automata-check-boundaries'), ['boundaries/dirty'])
        if (clean !== 0 || dirty !== 1)
          throw new Error(`clean exited ${clean} (want 0), dirty ${dirty} (want 1)`)
        return 'clean 0, dirty 1'
      },
    ],
    [
      'types: tsc --noEmit with TypeScript 7',
      () => sh(project, bin('tsc'), ['-p', 'tsconfig.json']) || 'clean',
    ],
    [
      // Node's own resolution, as a game without a bundler (or a tool's tsconfig) checks it: needs full paths.
      'types: tsc --noEmit with TypeScript 7 and nodenext resolution',
      () => sh(project, bin('tsc'), ['-p', 'tsconfig.nodenext.json']) || 'clean',
    ],
    [
      'types: tsc --noEmit with TypeScript 6',
      () =>
        sh(project, 'node', [join(project, 'node_modules/typescript6/bin/tsc'), '-p', 'tsconfig.json']) ||
        'clean',
    ],
    [
      'eval: no new Function or eval( in any published package',
      () => {
        const offenders = filesBelow(installed)
          .filter((file) => file.endsWith('.js') || file.endsWith('.svelte'))
          .filter((file) => !file.includes('/dist/vendor/')) // ship's copy of Ruken's Node CLI never runs in a game
          .filter((file) => !file.includes('/@automata/tools/')) // build tools run in Node; `automata check` names eval to flag it
          .filter((file) => EVAL.test(readFileSync(file, 'utf8')))
        if (offenders.length > 0) throw new Error(`eval in:\n${offenders.join('\n')}`)
        return 'none'
      },
    ],
    [
      'bundle: vite build of sim + host + a ui component, one Ruken SDK',
      () => {
        sh(join(project, 'web'), bin('vite'), ['build', '--config', 'vite.config.ts', '--logLevel', 'warn'])
        const code = filesBelow(join(project, 'web/dist'))
          .filter((file) => file.endsWith('.js'))
          .map((file) => readFileSync(file, 'utf8'))
          .join('\n')
        const copies = code.split(SDK_MARKER).length - 1
        if (copies !== 1) throw new Error(`the bundle has ${copies} copies of Ruken's SDK (want 1)`)
        return `${Math.round(code.length / 1024)} kB of JavaScript, 1 Ruken SDK`
      },
    ],
    [
      // An itch.io or web build resolves `@automata/framework/target` to the web adapter, so the
      // published `dist` must let it drop every byte of the Ruken SDK.
      'bundle: vite build with the automata-web condition, no Ruken SDK',
      () => {
        sh(join(project, 'web-target'), bin('vite'), [
          'build',
          '--config',
          'vite.config.ts',
          '--logLevel',
          'warn',
        ])
        const code = filesBelow(join(project, 'web-target/dist'))
          .filter((file) => file.endsWith('.js'))
          .map((file) => readFileSync(file, 'utf8'))
          .join('\n')
        const markers = findRukenSdkMarkers(code)
        if (markers.length > 0)
          throw new Error(`the web-target bundle has Ruken SDK code: ${markers.join(', ')}`)
        if (!code.includes('automata:storage-probe'))
          throw new Error('the web-target bundle has no web adapter')
        return `${Math.round(code.length / 1024)} kB of JavaScript, no Ruken SDK`
      },
    ],
    [
      // Runtime, render-pixi, game and the umbrella, installed from their packs, make one game whose
      // Ruken build (the `automata-ruken` condition) carries the SDK once.
      'game: vite build of a minimal @automata/framework game for Ruken, one Ruken SDK',
      () => {
        const game = join(project, 'game')
        sh(game, bin('vite'), ['build', '--config', 'vite.ruken.config.ts', '--logLevel', 'warn'])
        const code = bundleCode(join(game, 'dist-ruken'))
        const copies = code.split(SDK_MARKER).length - 1
        if (copies !== 1) throw new Error(`the game's bundle has ${copies} copies of Ruken's SDK (want 1)`)
        return `${Math.round(code.length / 1024)} kB of JavaScript, 1 Ruken SDK`
      },
    ],
    [
      // The same game's web build boots in Chromium, under the headers Ruken would serve it with, to its
      // title, and Play starts it.
      "game: the web build boots in Chromium under Ruken's CSP and plays",
      async () => {
        const game = join(project, 'game')
        sh(game, bin('vite'), ['build', '--config', 'vite.config.ts', '--logLevel', 'warn'])
        const server = await serveStatic(join(game, 'dist'), rukenHeaders(join(game, 'ruken.toml')))
        try {
          return await bootGame(`${server.url}/`)
        } finally {
          await server.close()
        }
      },
    ],
  ]
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2))
  const project = mkdtempSync(join(tmpdir(), 'af-consumer-smoke-'))
  console.log(
    `consumer-smoke: ${args.from}${args.version === undefined ? '' : ` ${args.version}`} in ${project}`,
  )
  let failed = 0
  try {
    cpSync(fixtures, project, { recursive: true })
    const packages =
      args.from === 'packs'
        ? packAll(root, project)
        : publishablePackages(root).map(({ manifest }) => ({ name: manifest.name }))
    const manifest = consumerManifest({
      from: args.from,
      version: args.version,
      packages,
      tools: toolVersions(),
      packageManager: rootPackageManager(),
    })
    writeFileSync(join(project, 'package.json'), `${JSON.stringify(manifest, null, 2)}\n`)
    writeFileSync(
      join(project, 'pnpm-workspace.yaml'),
      consumerWorkspace({ from: args.from, version: args.version, packages }),
    )
    // The packages are public on npmjs.org, so the project needs no .npmrc and no token, as for a stranger.
    // No workspace above the temp folder, so this is a plain install, as in a game repository.
    sh(project, 'pnpm', ['install', '--no-frozen-lockfile'])
    console.log('✓ install')
    for (const [name, run] of steps(project)) {
      try {
        console.log(`✓ ${name}: ${await run()}`)
      } catch (error) {
        failed += 1
        console.log(`✗ ${name}\n${error instanceof Error ? error.message : String(error)}`)
      }
    }
  } catch (error) {
    failed += 1
    console.log(`✗ setup\n${error instanceof Error ? error.message : String(error)}`)
  } finally {
    if (!args.keep) rmSync(project, { recursive: true, force: true })
  }
  console.log(failed === 0 ? 'consumer-smoke: passed' : `consumer-smoke: ${failed} step(s) failed`)
  process.exitCode = failed === 0 ? 0 : 1
}

await main()
