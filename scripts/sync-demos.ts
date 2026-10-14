import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

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

const RAW_DEMOS = [
  {
    slug: 'renderer-2d',
    title: 'Renderer: 2D PixiJS',
    category: '2D Rendering',
    path: 'examples/render-pixi/renderer-2d',
    bundleUrl: '/demos/render-pixi/renderer-2d/index.html',
  },
  {
    slug: 'bodies-2d',
    title: 'Physics: bodies 2D',
    category: 'Physics',
    path: 'examples/physics/bodies-2d',
    bundleUrl: '/demos/physics/bodies-2d/index.html',
  },
  {
    slug: 'boot-and-flow',
    title: 'Runtime: boot and flow',
    category: 'Runtime & Host',
    path: 'examples/runtime/boot-and-flow',
    bundleUrl: '/demos/runtime/boot-and-flow/index.html',
  },
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
    slug: 'lifecycle-and-saves',
    title: 'Host: lifecycle and saves',
    category: 'Runtime & Host',
    path: 'examples/host/lifecycle-and-saves',
    bundleUrl: '/demos/host/lifecycle-and-saves/index.html',
  },
  {
    slug: 'base-2d',
    title: 'Emberwick: Base 2D Adventure',
    category: 'Sim & Core',
    path: 'examples/base-2d',
    bundleUrl: '/demos/base-2d/index.html',
  },
]

export function extractHeader(source: string, key: string): string {
  const regex = new RegExp(`^\\/\\/\\s*${key}:\\s*(.+)$`, 'm')
  const match = source.match(regex)
  return match ? match[1].trim() : ''
}

export function syncDemos() {
  const catalog: DemoItem[] = []
  const staticDemosDir = join(websiteDir, 'static/demos')

  for (const item of RAW_DEMOS) {
    const fullSourcePath = join(frameworkDir, item.path, 'main.ts')
    let sourceCode = ''
    if (existsSync(fullSourcePath)) {
      sourceCode = readFileSync(fullSourcePath, 'utf-8')
    } else {
      sourceCode = `// Demo: ${item.title}\n// Shows: Standard demonstration of ${item.title}.\n// Controls: Arrow keys / Touch.\n// Base: base-2d.\n// Packages: @mcthaydt/automata-sim, @mcthaydt/automata-runtime.\n\nconsole.log('Automata Demo: ${item.title}');\n`
    }

    const shows = extractHeader(sourceCode, 'Shows') || `Demonstration of ${item.title}.`
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
    const exampleRelative = item.path.replace(/^examples\//, '')
    const targetDemoDir = join(staticDemosDir, exampleRelative)
    const frameworkDistDir = join(frameworkDir, item.path, 'dist')

    if (!existsSync(targetDemoDir)) {
      mkdirSync(targetDemoDir, { recursive: true })
    }

    if (existsSync(frameworkDistDir)) {
      cpSync(frameworkDistDir, targetDemoDir, { recursive: true })
    } else {
      const fallbackHtml = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    body { margin: 0; background: #09090b; color: #22d3ee; font-family: monospace; display: flex; align-items: center; justify-content: center; height: 100vh; }
  </style>
</head>
<body data-state="ready">
  <div style="text-align: center;">
    <h3 style="margin-bottom: 8px;">${item.title}</h3>
    <p style="color: #a1a1aa; font-size: 13px;">${shows}</p>
    <canvas id="game" width="320" height="192" style="border: 1px solid #27272a; margin-top: 12px; background: #121215;"></canvas>
  </div>
</body>
</html>`
      writeFileSync(join(targetDemoDir, 'index.html'), fallbackHtml)
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
  syncDemos()
  console.log('Successfully synced demos to src/data/demos.json and static/demos/')
}
