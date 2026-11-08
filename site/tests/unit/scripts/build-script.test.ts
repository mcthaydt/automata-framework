// @vitest-environment node
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { moveNotFoundPage } from '../../../scripts/make-404.ts'

const packageJson = JSON.parse(readFileSync(resolve('package.json'), 'utf8')) as {
  scripts: { build: string }
}
const steps = packageJson.scripts.build.split('&&').map((step) => step.trim())

describe('the build script', () => {
  it('ends with the closed-beta scan, because Pixi 3D’s terms allow no public deployment', () => {
    expect(steps.at(-1)).toBe('node scripts/scan-closed-beta.ts build')
  })

  it('moves the missing-address page to 404.html before the sitemap is written, so the sitemap cannot list it', () => {
    const move = steps.findIndex((step) => step.includes('make-404.ts'))
    const sitemap = steps.findIndex((step) => step.includes('write-seo-files.ts'))
    expect(move).toBeGreaterThan(steps.findIndex((step) => step.startsWith('vite build')))
    expect(move).toBeLessThan(sitemap)
  })

  it('asks adapter-static for no fallback page, and for addresses from the root so a nested 404 keeps its styles', async () => {
    const config = (await import('../../../svelte.config.js')).default
    expect(config.kit.adapter).toBeDefined()
    expect(config.kit.paths?.relative).toBe(false)
    expect(readFileSync(resolve('svelte.config.js'), 'utf8')).not.toContain('fallback')
  })
})

describe('moveNotFoundPage', () => {
  it('renames not-found.html and its compressed copies to 404.html, and leaves no not-found file', () => {
    const root = mkdtempSync(join(tmpdir(), 'build-404-'))
    for (const suffix of ['', '.br', '.gz'])
      writeFileSync(join(root, `not-found.html${suffix}`), `page${suffix}`)
    mkdirSync(join(root, 'docs'))
    moveNotFoundPage(root)
    for (const suffix of ['', '.br', '.gz']) {
      expect(readFileSync(join(root, `404.html${suffix}`), 'utf8')).toBe(`page${suffix}`)
      expect(existsSync(join(root, `not-found.html${suffix}`))).toBe(false)
    }
  })

  it('fails loudly when the build wrote no such page', () => {
    expect(() => moveNotFoundPage(mkdtempSync(join(tmpdir(), 'build-404-')))).toThrow(/not-found\.html/)
  })
})
