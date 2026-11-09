import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createServer, resolveConfig, type ViteDevServer } from 'vite'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { CatalogEntry } from '#src/catalog.ts'
import { examplePage, indexPage } from '#src/page-template.ts'
import { examplesRunner } from '#src/vite-plugin.ts'

const root = fileURLToPath(new URL('../fixtures/examples/', import.meta.url))
const stubStart = fileURLToPath(new URL('../fixtures/stub-start-game.ts', import.meta.url))
const options = {
  root,
  start: stubStart,
  catalog: { deliveryPlan: fileURLToPath(new URL('../fixtures/catalog/delivery-plan.md', import.meta.url)) },
}

describe('examplePage', () => {
  it('imports no-eval first, then startGame, then the example, and starts it', () => {
    const html = examplePage(
      { path: 'core/core-stub.ts', id: 'core-stub', title: 'a stub' },
      { start: stubStart, noEval: '@automataframework/automata/no-eval' },
    )
    const imports = [...html.matchAll(/^\s*import .*'(.+)'$/gm)].map((match) => match[1])
    expect(imports).toEqual(['@automataframework/automata/no-eval', stubStart, '/core/core-stub.ts'])
    expect(html).toContain('startGame(example)')
  })

  it('gives the game its root, `#game`, before the script that starts it', () => {
    const html = examplePage(
      { path: 'core/core-stub.ts', id: 'core-stub', title: 'a stub' },
      { start: stubStart, noEval: '@automataframework/automata/no-eval' },
    )
    expect(html).toMatch(/<main id="game"><\/main>\s*<script type="module">/)
  })
})

describe('indexPage', () => {
  const shot: CatalogEntry = {
    file: '/examples/core/core-good.ts',
    path: 'core/core-good.ts',
    module: 'core',
    name: 'good',
    id: 'core-good',
    url: '/core/good/',
    header: {
      name: 'core-good',
      title: 'a valid example',
      shows: 'a fixture.',
      controls: 'none',
      packages: ['@automataframework/automata-sim'],
      difficulty: 1,
      tier: 'core',
      lines: 7,
    },
    screenshot: 'core/core-good.png',
    codeLines: 2,
    imports: [],
    problems: [],
  }

  it('shows an approved screenshot and links the example to the fake host with its source', () => {
    const html = indexPage([shot], 'http://127.0.0.1:5132')
    expect(html).toContain('<img src="./core/core-good.png"')
    const view = /<a data-view href="([^"]+)"/.exec(html)?.[1]?.replaceAll('&amp;', '&')
    expect(view).toBeDefined()
    const url = new URL(view as string)
    expect(url.origin).toBe('http://127.0.0.1:5132')
    expect(url.searchParams.get('game')).toBe('./core/good/')
    expect(url.searchParams.get('source')).toBe('./core/good/source/')
    expect(url.searchParams.get('id')).toBe('af-examples')
  })
})

describe('examplesRunner', () => {
  let server: ViteDevServer
  let origin: string

  beforeAll(async () => {
    server = await createServer({
      configFile: false,
      logLevel: 'silent',
      plugins: [examplesRunner(options)],
      server: { port: 0, host: '127.0.0.1' },
    })
    await server.listen()
    const address = server.httpServer?.address()
    if (address === null || typeof address !== 'object') throw new Error('no server address')
    origin = `http://127.0.0.1:${address.port}`
  })
  afterAll(() => server.close())

  it('serves /core/stub/ as the generated page, with Ruken’s CSP', async () => {
    const response = await fetch(`${origin}/core/stub/`)
    expect(response.status).toBe(200)
    const csp = response.headers.get('content-security-policy')
    expect(csp).toContain("script-src 'self'")
    expect(csp).not.toMatch(/'unsafe-eval'/)
    const html = await response.text()
    // Vite turns the page's module script into a proxy module; fetch it and check the import order.
    const proxy = /src="([^"]+html-proxy[^"]+)"/.exec(html)?.[1]
    expect(proxy).toBeDefined()
    const script = await (await fetch(`${origin}${proxy}`)).text()
    const noEval = script.indexOf('no-eval')
    expect(noEval).toBeGreaterThan(-1)
    expect(noEval).toBeLessThan(script.indexOf('stub-start-game'))
    expect(script.indexOf('stub-start-game')).toBeLessThan(script.indexOf('core-stub.ts'))
  })

  it('lists every example on the index under its module, pending ones as pending', async () => {
    const html = await (await fetch(`${origin}/`)).text()
    expect(html).toContain('<section data-module="core">')
    expect(html).toContain('href="./core/stub/"')
    expect(html).toContain('href="./core/stub/source/"')
    expect(html).toContain('href="./core/later/source/"')
    expect(html).toMatch(/core-later[\s\S]*pending: OPEN\.1/)
    // Only a runnable example has a View link (the fake host around it, with its source).
    expect([...html.matchAll(/<a data-view /g)]).toHaveLength(1)
  })

  it('serves each example’s source, pending ones too, as a page that runs nothing', async () => {
    for (const [path, file] of [
      ['/core/stub/source/', 'core/core-stub.ts'],
      ['/core/later/source/', 'core/core-later.ts'],
    ] as const) {
      const response = await fetch(`${origin}${path}`)
      expect(response.status, path).toBe(200)
      expect(response.headers.get('content-security-policy'), path).toContain("script-src 'self'")
      const html = await response.text()
      expect(html, path).not.toContain('<script')
      const code = /<pre><code>([\s\S]*)<\/code><\/pre>/.exec(html)?.[1] ?? ''
      const text = code
        .replaceAll('&lt;', '<')
        .replaceAll('&gt;', '>')
        .replaceAll('&quot;', '"')
        .replaceAll('&amp;', '&')
      expect(text, path).toBe(readFileSync(`${root}${file}`, 'utf8'))
    }
  })

  it('serves a pending example as a page that says so and runs nothing', async () => {
    const html = await (await fetch(`${origin}/core/later/`)).text()
    expect(html).toContain('pending: OPEN.1')
    expect(html).not.toContain('<script')
  })

  it('previews with the same CSP and builds the index and every non-pending example', async () => {
    const config = await resolveConfig({ configFile: false, plugins: [examplesRunner(options)] }, 'build')
    expect(config.preview.headers?.['Content-Security-Policy']).toContain("script-src 'self'")
    const input = config.build.rollupOptions.input as Record<string, string>
    expect(Object.keys(input).sort()).toEqual(['core-later-source', 'core-stub', 'core-stub-source', 'index'])
  })

  // The examples run inside the fake Ruken host's frame, so the build takes the Ruken adapter (DIST spec §5.3: with no
  // AF condition, `@automataframework/automata-host/target` is the web adapter).
  it('builds every example for the ruken target', async () => {
    const config = await resolveConfig({ configFile: false, plugins: [examplesRunner(options)] }, 'build')
    expect(config.resolve.conditions[0]).toBe('automata-ruken')
  })

  // Vite inlines an asset under `assetsInlineLimit` as a `data:` URL, and Pixi's loader fetches it, which
  // Ruken's CSP (`connect-src 'self'`) refuses: a 278-byte sprite sheet drew nothing (textures-sprite).
  it('emits every asset as a file, so none becomes a data: URL the CSP refuses to fetch', async () => {
    const config = await resolveConfig({ configFile: false, plugins: [examplesRunner(options)] }, 'build')
    expect(config.build.assetsInlineLimit).toBe(0)
  })
})
