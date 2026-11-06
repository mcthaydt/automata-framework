import { existsSync, lstatSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, extname, join, relative, resolve } from 'node:path'
import ts from 'typescript'
import type { ExampleSources, SourceFile } from '../../data/project-types.ts'
import { featureDemos } from './examples.ts'
import { repositoryRoot } from './root.ts'

// The source explorer's files: each project the site shows (Emberwick and the feature demos), with every file it is
// built from, read from the workspace at build time.

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
        if (!name.startsWith('@af-examples/') && !name.startsWith('@af-games/')) continue
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

/** Emberwick and every feature demo, as the source explorer shows them. */
export function projectSources(root: string = repositoryRoot): ExampleSources {
  const demos = featureDemos(root).map((demo) => ({ slug: demo.slug, path: `examples/2d/${demo.path}` }))
  return collectExampleSources(root, [{ slug: 'emberwick', path: 'games/emberwick' }, ...demos])
}
