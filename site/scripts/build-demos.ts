import { execFileSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { compileExample } from '../src/features/playground/compile.ts'
import { demoList } from '../src/shared/framework/demos.ts'
import { sceneExamples } from '../src/shared/framework/examples.ts'
import { repositoryRoot } from '../src/shared/framework/root.ts'
import { SITE_ORIGIN } from '../src/shared/site.js'
import { arrangeScenes } from './scenes.ts'
import { writeApiIndex } from './write-api-index.ts'

// `node scripts/build-demos.ts`: the built games the site serves, written into static/ (git ignores both folders),
// where Vite and the static build pick them up:
// - static/demos/<slug>/: Emberwick and each feature demo, built by their own packages;
// - static/editor/app/: the editors' 2D suite, the page `automata editor` serves a 2D game, for "Try the editor" (its files are
//   named relative to its page, so it runs at that address unchanged);
// - static/playground/: the playground's runtime, frame pages, resources and goldens (playground/build.ts), with
//   every example precompiled (compiled/<id>.js), so an example's first run needs no compiler.
// - static/scenes/: the 3D examples the site shows (`sceneExamples`), built for the web adapter by the 3D examples
//   package's own runner, pruned to those examples (scripts/scenes.ts). None until the kits they import are public.
// - tooling/api-index/dist/: the API index (`pnpm api-index`), which the API pages and the agents' text files read.
// It builds what it needs through turbo, so a fresh checkout needs no other command, and a cached build costs little.

const siteRoot = fileURLToPath(new URL('..', import.meta.url))
const staticDir = join(siteRoot, 'static')

/** A built demo's page names its files from the root (`/assets/...`); served under /demos/<slug>/, they move there. */
export function relocateDemoAssets(html: string, base: string): string {
  return html.replace(/(["'])\/assets\//g, `$1${base}assets/`)
}

function packageName(path: string): string {
  return (JSON.parse(readFileSync(join(repositoryRoot, path, 'package.json'), 'utf8')) as { name: string })
    .name
}

/** The demos' builds and the published packages' builds (the API index reads their declarations), in one turbo run. */
function buildPackages(): void {
  const filters = ['./packages/*', ...demoList().map((demo) => packageName(demo.path))].flatMap((name) => [
    '--filter',
    name,
  ])
  execFileSync('pnpm', ['exec', 'turbo', 'run', 'build', ...filters, '--output-logs=errors-only'], {
    cwd: repositoryRoot,
    stdio: 'inherit',
  })
}

/**
 * The demos that play in a page with no Ruken host to answer them. Their `dist/` is the Ruken build, whose SDK sends
 * `hello` to its parent and waits ten seconds for a `welcome` before it runs standalone, so Home would sit on "Loading…"
 * that long. The site frames the web build of the same game instead, written to the folder named here.
 */
const WEB_BUILDS: ReadonlyMap<string, string> = new Map([['emberwick', 'dist-web']])

/** Builds each of `WEB_BUILDS` for the web target (`vite build --mode web`). */
function buildWebDemos(): void {
  const demos = demoList()
  for (const [slug, outDir] of WEB_BUILDS) {
    const demo = demos.find((candidate) => candidate.slug === slug)
    if (demo === undefined) throw new Error(`There is no demo "${slug}" to build for the web.`)
    execFileSync(
      'pnpm',
      [
        'exec',
        'vite',
        'build',
        '--configLoader',
        'runner',
        '--mode',
        'web',
        '--outDir',
        outDir,
        '--logLevel',
        'warn',
      ],
      { cwd: join(repositoryRoot, demo.path), stdio: 'inherit' },
    )
  }
}

function copyDemos(): number {
  const demos = demoList()
  const target = join(staticDir, 'demos')
  rmSync(target, { recursive: true, force: true })
  for (const demo of demos) {
    const dist = join(repositoryRoot, demo.path, WEB_BUILDS.get(demo.slug) ?? 'dist')
    if (!existsSync(join(dist, 'index.html')))
      throw new Error(`${demo.path}: its build wrote no dist/index.html`)
    const folder = join(target, demo.slug)
    cpSync(dist, folder, { recursive: true })
    const index = join(folder, 'index.html')
    writeFileSync(index, relocateDemoAssets(readFileSync(index, 'utf8'), `/demos/${demo.slug}/`))
  }
  return demos.length
}

/**
 * The editors' 2D suite, copied as it is: on the site no editor server answers, so it opens the sample game, where a
 * visitor starts a level from a template and keeps it with Share (`share-leaves-the-browser` serves the same build).
 */
function copyEditor(): void {
  const dist = join(repositoryRoot, 'packages/editor/dist/suite')
  if (!existsSync(join(dist, 'index.html')))
    throw new Error('packages/editor: its build wrote no dist/suite/index.html')
  const target = join(staticDir, 'editor', 'app')
  rmSync(join(staticDir, 'editor'), { recursive: true, force: true })
  cpSync(dist, target, { recursive: true })
}

function buildPlayground(): number {
  // playground/build.ts writes only a folder named dist-playground, then the site serves it as /playground/.
  const built = join(siteRoot, 'playground', 'dist-playground')
  execFileSync(process.execPath, ['playground/build.ts', '--site-origin', SITE_ORIGIN, '--out', built], {
    cwd: siteRoot,
    stdio: ['ignore', 'inherit', 'inherit'],
  })
  const catalog = JSON.parse(readFileSync(join(built, 'catalog.json'), 'utf8')) as {
    id: string
    source: string
    moduleUrl: string
  }[]
  mkdirSync(join(built, 'compiled'))
  for (const example of catalog) {
    // What `import.meta.url` becomes in an example: its module path under the site's origin.
    const result = compileExample(example.source, {
      id: example.id,
      moduleUrl: new URL(example.moduleUrl, SITE_ORIGIN).href,
    })
    if (!result.ok)
      throw new Error(
        `${example.id} does not compile: ${result.diagnostics.map((d) => `${d.line}:${d.column} ${d.message}`).join('; ')}`,
      )
    writeFileSync(join(built, 'compiled', `${example.id}.js`), result.code)
  }
  const target = join(staticDir, 'playground')
  rmSync(target, { recursive: true, force: true })
  cpSync(built, target, { recursive: true })
  rmSync(built, { recursive: true })
  return catalog.length
}

/**
 * Builds the 3D examples the site shows into static/scenes/: one `vite build` of the examples folder (the runner builds
 * every example in it, into its `dist/`), for the web adapter because a frame on the site has no Ruken host, then `arrangeScenes` takes
 * out every example the site does not show. With none to show (every example today), the folder is only removed and no
 * build runs.
 */
export function buildScenes(): number {
  const target = join(staticDir, 'scenes')
  rmSync(target, { recursive: true, force: true })
  const scenes = sceneExamples()
  if (scenes.length === 0) return 0
  // `AF_SITE_SCENES_DIR` names another folder for the one build that proves the pages on fixtures (sceneExamples).
  const examples = resolve(repositoryRoot, process.env.AF_SITE_SCENES_DIR ?? 'examples/3d')
  // Run from the site, whose Vite it is, with the folder's own config: the fixture folder is not a workspace package.
  execFileSync(
    'pnpm',
    [
      'exec',
      'vite',
      'build',
      '--config',
      join(examples, 'vite.config.ts'),
      '--configLoader',
      'runner',
      '--logLevel',
      'warn',
    ],
    { cwd: siteRoot, stdio: 'inherit', env: { ...process.env, AF_EXAMPLES_TARGET: 'web' } },
  )
  // The runner's config names its own output folder, `dist/`, as the demos' packages do: copy it, then prune the copy.
  cpSync(join(examples, 'dist'), target, { recursive: true })
  arrangeScenes(target, examples, scenes)
  return scenes.length
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--scenes-only')) {
    // The fixture build (tests/e2e/scene-examples.e2e.ts) adds these to a site `pnpm build` has already made.
    console.log(`build-demos: ${buildScenes()} 3D examples in static/scenes.`)
    process.exit(0)
  }
  buildPackages()
  buildWebDemos()
  writeApiIndex()
  const demos = copyDemos()
  copyEditor()
  const examples = buildPlayground()
  const scenes = buildScenes()
  console.log(
    `build-demos: ${demos} demos in static/demos, the 2D editor in static/editor/app, ${examples} examples in static/playground, ${scenes} 3D examples in static/scenes.`,
  )
}
