import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Effect } from 'effect'
import { afterAll, describe, expect, it } from 'vitest'
import { probeDist } from './csp-probe-live.ts'

// The live CSP probe in real Chromium, on tiny builds written here (a checked-in eval would fail biome). Needs
// Playwright's Chromium: run with `pnpm --filter @mcthaydt/automata-cli test:slow` and PLAYWRIGHT_BROWSERS_PATH set.

const repoRoot = fileURLToPath(new URL('../../../..', import.meta.url))
const headers = {
  'Content-Security-Policy': "default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self'",
}
const root = mkdtempSync(join(tmpdir(), 'automata-check-csp-'))
afterAll(() => rmSync(root, { recursive: true, force: true }))

function build(name: string, script: string): string {
  const dist = join(root, name)
  mkdirSync(dist)
  writeFileSync(
    join(dist, 'index.html'),
    '<!doctype html><title>t</title><script type="module" src="./main.js"></script>',
  )
  writeFileSync(join(dist, 'main.js'), script)
  return dist
}

const probe = (distDir: string, timeoutMs = 20_000) =>
  Effect.runPromise(probeDist({ distDir, headers, timeoutMs, resolveFrom: repoRoot }))

describe('probeDist in Chromium', () => {
  it('passes a build that reports ready', async () => {
    const dist = build('ready', 'document.documentElement.dataset.state = "ready"')
    expect(await probe(dist)).toEqual({ ready: true, state: 'ready', violations: [] })
  }, 60_000)

  it('reports a CSP violation even when the game catches the EvalError', async () => {
    const dist = build(
      'eval',
      'try { (0, globalThis["ev" + "al"])("1") } catch {}\ndocument.documentElement.dataset.state = "ready"',
    )
    const result = await probe(dist)
    expect(result.ready).toBe(true)
    expect(result.violations).toHaveLength(1)
    expect(result.violations[0]).toContain('script-src')
  }, 60_000)

  it('reports a game that never gets ready, and one that fails', async () => {
    const loading = build('loading', 'document.documentElement.dataset.state = "loading"')
    expect(await probe(loading, 1_000)).toEqual({ ready: false, state: 'loading', violations: [] })
    const failed = build('failed', 'document.documentElement.dataset.state = "failed"')
    expect(await probe(failed)).toEqual({ ready: false, state: 'failed', violations: [] })
  }, 60_000)

  it('without Playwright it is a missing tool, not a pass', async () => {
    const dist = build('no-playwright', '')
    const outcome = await Effect.runPromise(
      Effect.either(probeDist({ distDir: dist, headers, timeoutMs: 1_000, resolveFrom: tmpdir() })),
    )
    expect(outcome._tag).toBe('Left')
    if (outcome._tag === 'Left') {
      expect(outcome.left.kind).toBe('missing')
      expect(outcome.left.message).toContain('npx playwright install chromium')
    }
  }, 60_000)
})
