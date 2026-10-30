import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, posix, resolve } from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import { collectExampleSources, demoBundleDirectory, RAW_DEMOS } from '../scripts/sync-demos'

describe('Demo bundle folders', () => {
  it('follow the public bundle URL, so Emberwick stays at /demos/base-2d after moving to games/', () => {
    const folders = Object.fromEntries(RAW_DEMOS.map(demo => [demo.slug, demoBundleDirectory(demo)]))
    expect(folders['base-2d']).toBe('base-2d')
    expect(folders['bodies-2d']).toBe('physics/bodies-2d')
    for (const demo of RAW_DEMOS) expect(demo.bundleUrl).toBe(`/demos/${demoBundleDirectory(demo)}/index.html`)
  })
})

describe('Example source inventory', () => {
  it('includes project files, shared starter dependencies and root configuration without publishing build output or secrets', () => {
    const root = mkdtempSync(join(tmpdir(), 'automata-sources-'))
    const write = (path: string, content: string) => { mkdirSync(join(root, path, '..'), { recursive: true }); writeFileSync(join(root, path), content) }
    try {
      write('tsconfig.base.json', '{"compilerOptions":{}}')
      write('games/base/package.json', '{"name":"@af-examples/base","scripts":{"dev":"vite"}}')
      write('games/base/src/sim.ts', 'export const seed = 42')
      write('examples/demo/package.json', '{"name":"@af-examples/demo","scripts":{"dev":"vite"},"dependencies":{"@af-examples/base":"workspace:*"}}')
      write('examples/demo/main.ts', "import { seed } from '@af-examples/base'")
      write('examples/demo/index.html', '<div id="game"></div>')
      write('examples/demo/vite.config.ts', 'export default {}')
      write('examples/demo/src/Panel.svelte', '<p>Game</p>')
      write('examples/demo/src/check.test.ts', 'test only')
      write('examples/demo/dist/main.js', 'build output')
      write('examples/demo/dist-e2e-host/assets.js', 'browser test build output')
      write('examples/demo/.env', 'SECRET=private')
      write('examples/demo/public/tile.png', '\u0000binary')
      const result = collectExampleSources(root, [{ slug: 'demo', path: 'examples/demo' }])
      const project = result.projects[0]
      expect(project.command).toBe('pnpm --filter @af-examples/demo dev')
      expect(project.files).toEqual(expect.arrayContaining(['examples/demo/main.ts', 'examples/demo/package.json', 'examples/demo/index.html', 'examples/demo/vite.config.ts', 'examples/demo/src/Panel.svelte', 'games/base/src/sim.ts', 'tsconfig.base.json', 'examples/demo/public/tile.png']))
      expect(project.files.some(path => /\.env|dist[^/]*\//.test(path))).toBe(false)
      expect(project.files).toContain('examples/demo/src/check.test.ts')
      expect(result.files.find(f => f.path === 'games/base/src/sim.ts')?.content).toBe('export const seed = 42')
      expect(result.files.find(f => f.path.endsWith('tile.png'))?.content).toBeUndefined()
    } finally { rmSync(root, { recursive: true, force: true }) }
  })

  it('keeps every example’s actual runtime sources and resolves shared example dependencies', () => {
    const result = collectExampleSources(resolve('../automata-framework'), [{ slug: 'bodies-2d', path: 'examples/physics/bodies-2d' }, { slug: 'base-2d', path: 'games/emberwick' }])
    const physics = result.projects[0]
    expect(physics.files).toContain('games/emberwick/src/render/renderer.ts')
    expect(physics.files).toContain('examples/physics/bodies-2d/sim/bodies.plugin.ts')
    expect(result.files.filter(f => f.path === 'games/emberwick/src/render/renderer.ts')).toHaveLength(1)
  })

  it('publishes the targets of every relative TypeScript import used by the examples', () => {
    const sources = collectExampleSources(resolve('../automata-framework'), RAW_DEMOS)
    for (const project of sources.projects) {
      const paths = new Set(project.files)
      for (const file of sources.files.filter(file => paths.has(file.path) && file.path.endsWith('.ts'))) {
        for (const imported of ts.preProcessFile(file.content ?? '').importedFiles) {
          if (!imported.fileName.startsWith('.')) continue
          const target = posix.normalize(posix.join(dirname(file.path), imported.fileName.split('?')[0]))
          const candidates = [target, target + '.ts', target + '/index.ts', target.replace(/\.js$/, '.ts')]
          expect(candidates.some(candidate => paths.has(candidate)), project.slug + ': ' + file.path + ' -> ' + imported.fileName).toBe(true)
        }
      }
    }
  })

})
