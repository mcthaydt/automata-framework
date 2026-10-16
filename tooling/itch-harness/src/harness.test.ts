import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { type ItchHarness, startItchHarness } from './harness.ts'

let build: string
let harness: ItchHarness

beforeAll(async () => {
  build = mkdtempSync(join(tmpdir(), 'itch-harness-'))
  mkdirSync(join(build, 'assets'))
  writeFileSync(
    join(build, 'index.html'),
    '<!doctype html><script type="module" src="./assets/main.js"></script>',
  )
  writeFileSync(join(build, 'assets', 'main.js'), 'console.log(1)')
  // Port 0: the OS picks free ports, so this test never clashes with a running e2e server.
  harness = await startItchHarness({ games: { placeholder: build }, pagePort: 0, gamePort: 0 })
})

afterAll(async () => {
  await harness.close()
  rmSync(build, { recursive: true, force: true })
})

describe('the itch-like harness game origin', () => {
  it('serves a build from its own subdirectory, as itch.io serves /html/<upload>/', async () => {
    const response = await fetch(`${harness.gameOrigin}/html/placeholder/`)
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('text/html')
    expect(await response.text()).toContain('./assets/main.js')
  })

  it('serves scripts with their type and to any origin (a sandboxed frame loads them from an opaque one)', async () => {
    const response = await fetch(`${harness.gameOrigin}/html/placeholder/assets/main.js`)
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('text/javascript')
    expect(response.headers.get('access-control-allow-origin')).toBe('*')
  })

  it.each([
    ['the origin root', '/index.html'],
    ['an unknown game', '/html/other/index.html'],
    ['a path out of the build', '/html/placeholder/%2e%2e/%2e%2e/etc/passwd'],
    ['a wrong-case name (itch.io is case-sensitive)', '/html/placeholder/Index.html'],
    ['a wrong-case folder', '/html/placeholder/Assets/main.js'],
  ])('answers 404 for %s', async (_name, path) => {
    expect((await fetch(`${harness.gameOrigin}${path}`)).status).toBe(404)
  })
})

describe('the itch-like harness embed page', () => {
  it('lives on another origin and frames the game build', async () => {
    expect(new URL(harness.pageOrigin).host).not.toBe(new URL(harness.gameOrigin).host)
    const response = await fetch(`${harness.pageOrigin}/?game=placeholder`)
    expect(response.status).toBe(200)
    const html = await response.text()
    expect(html).toContain(`src="${harness.gameOrigin}/html/placeholder/index.html"`)
    expect(html).not.toContain('sandbox=')
  })

  it('blocks the frame storage on ?storage=blocked', async () => {
    const html = await (await fetch(`${harness.pageOrigin}/?game=placeholder&storage=blocked`)).text()
    expect(html).toContain('sandbox=')
  })

  it('answers 404 for an unknown game', async () => {
    expect((await fetch(`${harness.pageOrigin}/?game=other`)).status).toBe(404)
  })
})
