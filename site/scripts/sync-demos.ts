import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, lstatSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, extname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { frameworkCommit, writeFrameworkRef } from './framework-source'
import type { ExampleSources, SourceFile } from '../src/data/project-types'

const __dirname = dirname(fileURLToPath(import.meta.url))
const frameworkDir = resolve(__dirname, '../../automata-framework')
const websiteDir = resolve(__dirname, '..')

export interface DemoItem {
  id: string
  slug: string
  path: string
  title: string
  category: string
  shows: string
  controls: string
  base: string
  packages: string[]
  sourceCode: string
  bundleUrl: string
}

// The folder demos that remain in the framework. EX.4 ported renderer-2d, boot-and-flow and lifecycle-and-saves to
// one-file examples (examples/render, examples/core), which reach the site with the playground (WEB.PLAY); the
// framework removed examples/physics/bodies-2d after 30e9606.
export const RAW_DEMOS = [
  {
    slug: 'ui-primitives',
    title: 'UI: primitives',
    category: 'Mobile UI',
    path: 'examples/ui/primitives',
    bundleUrl: '/demos/ui/primitives/index.html',
  },
  {
    slug: 'hot-reload',
    title: 'Content: hot reload',
    category: 'Content',
    path: 'examples/content/hot-reload',
    bundleUrl: '/demos/content/hot-reload/index.html',
  },
  {
    slug: 'base-2d',
    title: 'Emberwick: Base 2D Adventure',
    category: 'Sim & Core',
    path: 'games/emberwick',
    bundleUrl: '/demos/base-2d/index.html',
  },
]

/** Where a demo's built bundle goes under static/demos: the folder its public URL names, wherever its source lives. */
export function demoBundleDirectory(demo: { bundleUrl: string }): string {
  return demo.bundleUrl.replace(/^\/demos\//, '').replace(/\/index\.html$/, '')
}

/** Replace a demo's published bundle with a fresh build. Hashed file names mean a plain copy would keep every old file. */
export function installDemoBundle(distDirectory: string, targetDirectory: string): void {
  if (!existsSync(join(distDirectory, 'index.html'))) throw new Error('The build in ' + distDirectory + ' has no index.html')
  rmSync(targetDirectory, { recursive: true, force: true })
  mkdirSync(targetDirectory, { recursive: true })
  cpSync(distDirectory, targetDirectory, { recursive: true })
}

export function extractHeader(source: string, key: string): string {
  const lines = source.split('\n')
  const start = lines.findIndex(line => line.startsWith('// ' + key + ':'))
  if (start < 0) return ''
  const parts = [lines[start].slice(lines[start].indexOf(':') + 1).trim()]
  for (const line of lines.slice(start + 1)) {
    const match = line.match(/^\/\/\s*(.*)$/)
    if (!match || !match[1] || /^[A-Z][A-Za-z ]+:/.test(match[1])) break
    parts.push(match[1])
  }
  return parts.join(' ').trim()
}

// Publish authored files only. Framework packages remain declared dependencies; shared example
// packages are included because their source is part of the example, rather than the library API.
export function collectExampleSources(root: string, entries: readonly { slug: string; path: string }[]): ExampleSources {
  const packages = new Map<string, string>()
  const findPackages = (directory: string) => {
    if (existsSync(join(directory, 'package.json'))) {
      const manifest = JSON.parse(readFileSync(join(directory, 'package.json'), 'utf8'))
      packages.set(manifest.name, directory)
      return
    }
    for (const item of readdirSync(directory, { withFileTypes: true })) {
      if (item.isDirectory() && !item.name.startsWith('.') && !['node_modules', 'dist'].includes(item.name)) findPackages(join(directory, item.name))
    }
  }
  // Example packages live under `examples/`; the base game moved to `games/` with EX.2.
  for (const folder of ['examples', 'games']) if (existsSync(join(root, folder))) findPackages(join(root, folder))
  const files = new Map<string, SourceFile>()
  const languages: Record<string, string> = { '.ts': 'typescript', '.js': 'javascript', '.mjs': 'javascript', '.svelte': 'svelte', '.json': 'json', '.css': 'css', '.html': 'html', '.toml': 'toml', '.yaml': 'yaml', '.yml': 'yaml', '.md': 'markdown', '.txt': 'text', '.glsl': 'glsl', '.wgsl': 'wgsl', '.svg': 'xml' }
  const binary = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.woff', '.woff2', '.mp3', '.ogg', '.wav', '.mp4', '.wasm'])
  const addFile = (absolute: string, paths: Set<string>) => {
    const path = relative(root, absolute).split('\\').join('/')
    if (path.startsWith('../') || path.split('/').some(part => part.startsWith('.'))) throw new Error('Source path outside published project scope: ' + path)
    const extension = path.endsWith('/LICENSE') || path === 'LICENSE' ? '.txt' : extname(path)
    if (!(extension in languages) && !binary.has(extension)) return
    paths.add(path)
    if (!files.has(path)) files.set(path, { path, language: languages[extension] ?? 'text', ...(binary.has(extension) ? {} : { content: readFileSync(absolute, 'utf8') }) })
  }
  const projects = entries.map(entry => {
    const paths = new Set<string>()
    const visited = new Set<string>()
    const collect = (directory: string) => {
      for (const item of readdirSync(directory, { withFileTypes: true })) {
        if (item.name.startsWith('.') || (/\.(spec|e2e)\./.test(item.name) || /\.(browser|parity|layout)\.test\./.test(item.name))) continue
        const absolute = join(directory, item.name)
        if (item.isDirectory()) {
          if (!item.name.startsWith('dist-') && !['node_modules', 'dist', 'build', 'coverage', 'e2e', 'tests', '__tests__', '__snapshots__', 'test-results', 'playwright-report'].includes(item.name)) collect(absolute)
        } else if (item.isFile()) addFile(absolute, paths)
      }
    }
    const visit = (directory: string) => {
      if (visited.has(directory)) return
      visited.add(directory)
      collect(directory)
      const manifest = JSON.parse(readFileSync(join(directory, 'package.json'), 'utf8'))
      for (const name of Object.keys({ ...manifest.dependencies, ...manifest.devDependencies }).sort()) {
        if (!name.startsWith('@af-examples/')) continue
        const dependency = packages.get(name)
        if (!dependency) throw new Error('Missing shared example package: ' + name)
        visit(dependency)
      }
    }
    const directory = join(root, entry.path)
    visit(directory)
    for (const name of ['package.json', 'pnpm-workspace.yaml', 'tsconfig.base.json', 'LICENSE', 'LICENSE-SCOPE.md']) {
      if (existsSync(join(root, name))) addFile(join(root, name), paths)
    }
    // Vite configs and shared helpers sometimes import sibling framework files by relative
    // path instead of a package name. Follow that closure so every displayed import has source.
    const queue = [...paths]
    for (let index = 0; index < queue.length; index++) {
      const path = queue[index]
      const source = files.get(path)
      if (!source?.content || !/\.(ts|js|mjs|svelte)$/.test(path)) continue
      for (const imported of ts.preProcessFile(source.content).importedFiles) {
        if (!imported.fileName.startsWith('.')) continue
        const target = resolve(root, dirname(path), imported.fileName.split('?')[0])
        const candidates = [target, target + '.ts', join(target, 'index.ts'), target.replace(/\.js$/, '.ts')]
        const absolute = candidates.find(candidate => existsSync(candidate) && lstatSync(candidate).isFile())
        if (!absolute) throw new Error('Unresolved example import: ' + path + ' -> ' + imported.fileName)
        const importedPath = relative(root, absolute).split('\\').join('/')
        if (!paths.has(importedPath)) { addFile(absolute, paths); queue.push(importedPath) }
      }
    }
    const manifest = JSON.parse(readFileSync(join(directory, 'package.json'), 'utf8'))
    if (!manifest.scripts?.dev) throw new Error('Missing dev command for ' + entry.path)
    return { slug: entry.slug, root: entry.path, name: manifest.name as string, command: 'pnpm --filter ' + manifest.name + ' dev', files: [...paths].sort() }
  })
  return { files: [...files.values()].sort((a, b) => a.path.localeCompare(b.path)), projects }
}

export function syncExampleSources() {
  const sources = collectExampleSources(frameworkDir, RAW_DEMOS)
  writeFileSync(join(websiteDir, 'src/data/projects.json'), JSON.stringify(sources, null, 2) + '\n')
  return sources
}

/** Keep website-hosting fixes outside the framework and its content-hash boundary. */
export function relocateDemoAssets(html: string, base: string): string {
  return html.replace(/(["'])\/assets\//g, '$1' + base + 'assets/')
}

export function prepareDemoHosting(staticRoot = join(websiteDir, 'static')) {
  for (const demo of RAW_DEMOS) {
    const index = join(staticRoot, demo.bundleUrl)
    if (existsSync(index)) {
      const html = readFileSync(index, 'utf8')
      writeFileSync(index, relocateDemoAssets(html, demo.bundleUrl.replace('index.html', '')))
    }
  }
}

export function syncDemos() {
  const catalog: DemoItem[] = []
  const staticDemosDir = join(websiteDir, 'static/demos')

  for (const item of RAW_DEMOS) {
    const fullSourcePath = join(frameworkDir, item.path, 'main.ts')
    if (!existsSync(fullSourcePath)) throw new Error('Missing demo source: ' + fullSourcePath)
    const sourceCode = readFileSync(fullSourcePath, 'utf-8')

    const shows = extractHeader(sourceCode, 'Shows').replace('WebGPU fallback', 'opt-in WebGPU') || `Demonstration of ${item.title}.`
    const controls = extractHeader(sourceCode, 'Controls') || 'Touch / Keyboard controls.'
    const base = extractHeader(sourceCode, 'Base') || 'none'
    const packagesRaw = extractHeader(sourceCode, 'Packages') || '@mcthaydt/automata-sim'
    const packages = packagesRaw
      .replace(/\.$/, '')
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean)

    catalog.push({
      id: item.slug,
      slug: item.slug,
      path: item.path,
      title: item.title,
      category: item.category,
      shows,
      controls,
      base,
      packages,
      sourceCode,
      bundleUrl: item.bundleUrl,
    })

    // Copy dist build to static/demos
    const targetDemoDir = join(staticDemosDir, demoBundleDirectory(item))
    const frameworkDistDir = join(frameworkDir, item.path, 'dist')

    if (existsSync(frameworkDistDir)) {
      installDemoBundle(frameworkDistDir, targetDemoDir)
    } else {
      // Keep an existing real bundle; never manufacture an empty canvas that claims readiness.
      if (!existsSync(join(targetDemoDir, 'index.html'))) throw new Error('Build the demo before syncing: ' + item.path)
    }
  }

  const outDir = join(websiteDir, 'src/data')
  if (!existsSync(outDir)) {
    mkdirSync(outDir, { recursive: true })
  }
  writeFileSync(join(outDir, 'demos.json'), JSON.stringify(catalog, null, 2))
  return catalog
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const commit = frameworkCommit(frameworkDir)
  syncDemos()
  syncExampleSources()
  prepareDemoHosting()
  writeFrameworkRef(websiteDir, commit)
  console.log(`Synced demos to src/data/demos.json and static/demos/ from framework ${commit.slice(0, 7)}; framework.ref updated.`)
}
