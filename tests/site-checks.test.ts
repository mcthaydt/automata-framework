// @vitest-environment node
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { checkSite } from '../scripts/site-checks'
import { writeSeoFiles } from '../scripts/write-seo-files'

const ORIGIN = 'https://automata.ruken.com'
const roots: string[] = []

function page(path: string, { body = '<p>Real content.</p>', head = '' } = {}): string {
  return `<!doctype html><html lang="en"><head>
<title>Page</title><meta name="description" content="A page." /><meta property="og:title" content="Page" />
<link rel="canonical" href="${ORIGIN}${path}" /><meta property="og:image" content="${ORIGIN}/social.png" />${head}
</head><body><main id="main"><h1>Page</h1>${body}</main></body></html>`
}

function sitemap(paths: string[]): string {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${paths.map(p => `<url><loc>${ORIGIN}${p}</loc></url>`).join('\n')}\n</urlset>\n`
}

/** A minimal build that passes every rule. Each case below breaks exactly one thing. */
function goodSite(): { root: string; write: (file: string, content: string | Uint8Array) => void } {
  const root = mkdtempSync(join(tmpdir(), 'qb3-site-'))
  roots.push(root)
  const write = (file: string, content: string | Uint8Array) => {
    mkdirSync(dirname(join(root, file)), { recursive: true })
    writeFileSync(join(root, file), content)
  }
  write('index.html', page('/', { body: '<p><a href="/docs">Docs</a></p>' }))
  write('docs.html', page('/docs'))
  write('sitemap.xml', sitemap(['/', '/docs']))
  write('robots.txt', `User-agent: *\nAllow: /\nSitemap: ${ORIGIN}/sitemap.xml\n`)
  return { root, write }
}

afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }) })

describe('checkSite', () => {
  it('passes a correct build', () => {
    expect(checkSite(goodSite().root)).toEqual([])
  })

  it('still reports a missing link destination', () => {
    const site = goodSite()
    site.write('docs.html', page('/docs', { body: '<a href="/nowhere">Gone</a>' }))
    expect(checkSite(site.root)).toContain('docs.html: missing destination /nowhere')
  })

  it('fails when a page is missing from the sitemap', () => {
    const site = goodSite()
    site.write('sitemap.xml', sitemap(['/']))
    expect(checkSite(site.root)).toContain('sitemap.xml: missing ' + ORIGIN + '/docs')
  })

  it('fails when the sitemap lists a URL with no page', () => {
    const site = goodSite()
    site.write('sitemap.xml', sitemap(['/', '/docs', '/gone']))
    expect(checkSite(site.root)).toContain('sitemap.xml: no page for ' + ORIGIN + '/gone')
  })

  it('fails without a sitemap or robots.txt', () => {
    const site = goodSite()
    rmSync(join(site.root, 'sitemap.xml'))
    rmSync(join(site.root, 'robots.txt'))
    expect(checkSite(site.root)).toEqual(expect.arrayContaining(['sitemap.xml: missing', 'robots.txt: missing']))
  })

  it('fails when robots.txt does not name the sitemap', () => {
    const site = goodSite()
    site.write('robots.txt', 'User-agent: *\nAllow: /\n')
    expect(checkSite(site.root)).toContain('robots.txt: no Sitemap: ' + ORIGIN + '/sitemap.xml line')
  })

  it('writeSeoFiles generates a sitemap and robots.txt that pass', () => {
    const site = goodSite()
    rmSync(join(site.root, 'sitemap.xml'))
    rmSync(join(site.root, 'robots.txt'))
    writeSeoFiles(site.root)
    expect(checkSite(site.root)).toEqual([])
  })
})
