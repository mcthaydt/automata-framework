import { fileURLToPath } from 'node:url'
import { createServer, resolveConfig, type ViteDevServer } from 'vite'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { examplePage } from './page-template.ts'
import { examplesRunner } from './vite-plugin.ts'

const root = fileURLToPath(new URL('./fixtures/examples/', import.meta.url))
const stubStart = fileURLToPath(new URL('./fixtures/stub-start-game.ts', import.meta.url))
const options = {
  root,
  start: stubStart,
  catalog: { deliveryPlan: fileURLToPath(new URL('./fixtures/catalog/delivery-plan.md', import.meta.url)) },
}

describe('examplePage', () => {
  it('imports no-eval first, then startGame, then the example, and starts it', () => {
    const html = examplePage(
      { path: 'core/core-stub.ts', id: 'core-stub', title: 'a stub' },
      { start: stubStart, noEval: '@mcthaydt/automata-render-pixi/no-eval' },
    )
    const imports = [...html.matchAll(/^\s*import .*'(.+)'$/gm)].map((match) => match[1])
    expect(imports).toEqual(['@mcthaydt/automata-render-pixi/no-eval', stubStart, '/core/core-stub.ts'])
    expect(html).toContain('startGame(example)')
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

  it('lists every example on the index, pending ones as pending', async () => {
    const html = await (await fetch(`${origin}/`)).text()
    expect(html).toContain('href="./core/stub/"')
    expect(html).toMatch(/core-later[\s\S]*pending: OPEN\.1/)
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
    expect(Object.keys(input).sort()).toEqual(['core-stub', 'index'])
  })
})
