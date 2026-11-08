import { execFileSync } from 'node:child_process'
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { basename, dirname, join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { build, type Rolldown } from 'vite'
import { readCatalog } from '../src/catalog.ts'
import { playgroundFramePage } from '../src/playground/frame-page.ts'
import { playgroundCatalog } from '../src/playground/playground-catalog.ts'
import { playgroundManifest } from '../src/playground/playground-manifest.ts'
import { publicResource } from '../src/playground/playground-resources.ts'
import { checkRuntimeSize, RUNTIME_GZIP_BUDGET } from '../src/playground/runtime-size.ts'
import { runtimeFromViteManifest } from '../src/playground/vite-runtime.ts'

// `build:playground --site-origin <origin> [--out <folder>]`: everything the site
// publishes under /playground/, for one site origin (each frame page's policy names it, R-2). The runtime is one Vite
// build (vite.config.ts); the frame pages, the examples' public files and resources, the goldens, catalog.json and
// manifest.json are written around it. The build fails when the runtime's JavaScript passes its gzip budget or a
// bundled package declares no licence.

const packageRoot = fileURLToPath(new URL('..', import.meta.url))
const examplesRoot = fileURLToPath(new URL('../../../examples/2d/', import.meta.url))

const { values } = parseArgs({
  options: {
    'site-origin': { type: 'string' },
    out: { type: 'string', default: join(packageRoot, 'dist-playground') },
  },
})
const siteOrigin = values['site-origin']
if (siteOrigin === undefined || new URL(siteOrigin).origin !== siteOrigin)
  throw new Error('build:playground needs --site-origin <scheme://host[:port]>')
// The build writes a folder of its own name only, and builds it beside the result first: a build that fails leaves
// the last good tree as it was, never a half-written one (a tree with no manifest).
const out = values.out
if (basename(out) !== 'dist-playground')
  throw new Error(`build:playground writes only a folder named dist-playground, not ${out}`)
const finalOut = out
const building = `${finalOut}.building`
rmSync(building, { recursive: true, force: true })

// The runtime.
const runtimeDir = join(building, 'runtime')
const result = await build({
  configFile: join(packageRoot, 'playground', 'vite.config.ts'),
  build: { outDir: runtimeDir },
})
const outputs = (Array.isArray(result) ? result : [result]) as Rolldown.RolldownOutput[]
const viteManifestFile = join(runtimeDir, '.vite', 'manifest.json')
const runtime = runtimeFromViteManifest(
  JSON.parse(readFileSync(viteManifestFile, 'utf8')),
  '/playground/runtime/',
)
rmSync(join(runtimeDir, '.vite'), { recursive: true })

// The examples: a frame page each, beside its public files; the shared resources; the goldens.
const entries = readCatalog(examplesRoot)
const catalog = playgroundCatalog(entries, (entry) => readFileSync(entry.file, 'utf8'))
const modules = new Set(catalog.map((example) => example.module))
if (modules.has('resources'))
  throw new Error('an examples module named resources would mix with examples/2d/resources/')
for (const example of catalog) {
  const folder = join(building, 'examples', example.module, example.name)
  const publicFiles = join(examplesRoot, 'public', example.module, example.name)
  if (existsSync(join(publicFiles, 'index.html')))
    throw new Error(`${example.id}: a public index.html would be replaced by the frame page`)
  if (existsSync(publicFiles)) cpSync(publicFiles, folder, { recursive: true })
  mkdirSync(folder, { recursive: true })
  writeFileSync(join(folder, 'index.html'), playgroundFramePage(example, runtime, siteOrigin))
  if (example.golden !== undefined)
    cpSync(
      join(examplesRoot, '__goldens__', `${example.id}.replay`),
      join(building, 'goldens', `${example.id}.replay`),
    )
}
// The shared resources, less what only an unpublished extension's examples use (The Last Light's models, which
// render-pixi3d draws): the site is public, and those stay private while D-1 stands.
const resourcesRoot = join(examplesRoot, 'resources')
const resourceFiles = readdirSync(resourcesRoot, { recursive: true, encoding: 'utf8' })
  .filter((name) => statSync(join(resourcesRoot, name)).isFile())
  .map((name) => name.split(sep).join('/'))
const isPublicResource = publicResource(entries, (entry) => readFileSync(entry.file, 'utf8'), resourceFiles)
cpSync(resourcesRoot, join(building, 'examples', 'resources'), {
  recursive: true,
  filter: (source) => {
    const path = relative(resourcesRoot, source).split(sep).join('/')
    return path === '' || isPublicResource(path)
  },
})
writeFileSync(join(building, 'catalog.json'), `${JSON.stringify(catalog, null, 2)}\n`)

// What the runtime bundles, from the modules Rolldown put in it: each package outside the workspace, with the
// version and licence its installed package.json declares.
function bundledPackages(): { name: string; version: string; licence: string | undefined }[] {
  const roots = new Set<string>()
  for (const output of outputs)
    for (const chunk of output.output)
      if (chunk.type === 'chunk')
        for (const id of chunk.moduleIds) {
          const match = /^(.*[\\/]node_modules[\\/](?:@[^\\/]+[\\/])?[^\\/]+)[\\/]/.exec(
            id.replace(/^\0/, ''),
          )
          if (match?.[1] !== undefined) roots.add(match[1])
        }
  return [...roots].map((root) => {
    const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as {
      name: string
      version: string
      license?: string
    }
    return { name: pkg.name, version: pkg.version, licence: pkg.license }
  })
}

function filesUnder(folder: string): { path: string; bytes: Uint8Array }[] {
  return readdirSync(folder, { recursive: true, encoding: 'utf8' })
    .map((name) => join(folder, name))
    .filter((file) => statSync(file).isFile())
    .map((file) => ({ path: relative(folder, file).split(sep).join('/'), bytes: readFileSync(file) }))
}

const files = filesUnder(building)
const size = checkRuntimeSize(files, RUNTIME_GZIP_BUDGET)
if (!size.ok)
  throw new Error(
    `the playground runtime is ${size.gzipBytes} B gzip, over its ${size.budget} B budget (spec §10.1)`,
  )
const framework = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: packageRoot, encoding: 'utf8' }).trim()
const manifest = playgroundManifest({ framework, siteOrigin, files, packages: bundledPackages() })
mkdirSync(dirname(join(building, 'manifest.json')), { recursive: true })
writeFileSync(join(building, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
rmSync(finalOut, { recursive: true, force: true })
renameSync(building, finalOut)
console.log(
  `build:playground: ${catalog.length} examples, ${files.length} files, runtime ${size.gzipBytes} B gzip of ${size.budget}, for ${siteOrigin}`,
)
