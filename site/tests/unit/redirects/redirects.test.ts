import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { JSDOM } from 'jsdom'
import { afterEach, describe, expect, it } from 'vitest'
import { builtPages } from '../../../scripts/site-checks.ts'
import { writeRedirects } from '../../../scripts/write-redirects.ts'
import { REDIRECTS, redirectPage } from '../../../src/features/redirects/redirects'

describe('the cut pages redirect', () => {
  // The site's old docs pages redirect too; tests/unit/docs/docs.test.ts names them.
  it('sends each old address to the page that took its place', () => {
    expect(REDIRECTS).toMatchObject({
      '/ai': '/docs/how-it-works',
      '/inside': '/docs/how-it-works',
      '/cheatsheet': '/api',
      '/editors': '/editor',
      '/showcase': '/',
      '/community': '/',
      '/proof': '/',
      '/releases': '/',
      '/sources': '/',
    })
  })

  it('is a page any static host can serve: a meta refresh and a link, no script', () => {
    const doc = new JSDOM(redirectPage('/api')).window.document
    expect(doc.querySelector('meta[http-equiv="refresh"]')?.getAttribute('content')).toBe('0; url=/api')
    expect(doc.querySelector('a')?.getAttribute('href')).toBe('/api')
    expect(doc.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe('noindex')
    expect(doc.querySelector('script')).toBeNull()
  })

  describe('in a build', () => {
    let root = ''
    afterEach(() => rmSync(root, { recursive: true, force: true }))

    it('writes one page per old address, kept out of the sitemap and the page checks', () => {
      root = mkdtempSync(join(tmpdir(), 'site-redirects-'))
      writeRedirects(root)
      for (const [from, to] of Object.entries(REDIRECTS)) {
        const file = join(root, from.slice(1) + '.html')
        expect(existsSync(file)).toBe(true)
        expect(readFileSync(file, 'utf8')).toContain(`url=${to}`)
      }
      expect(builtPages(root)).toEqual([])
    })
  })
})
