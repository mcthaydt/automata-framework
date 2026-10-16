// @vitest-environment node
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { checkSite } from '../scripts/site-checks'
import { writeSeoFiles } from '../scripts/write-seo-files'

const ORIGIN = 'https://automata.ruken.com'
const roots: string[] = []

function page(path: string, { body = '<p>Real content.</p>', head = ICON_LINKS } = {}): string {
  return `<!doctype html><html lang="en"><head>
<title>Page</title><meta name="description" content="A page." /><meta property="og:title" content="Page" />
<link rel="canonical" href="${ORIGIN}${path}" /><meta property="og:image" content="${ORIGIN}/social.png" />${head}
</head><body><main id="main"><h1>Page</h1>${body}</main></body></html>`
}

function sitemap(paths: string[]): string {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${paths.map(p => `<url><loc>${ORIGIN}${p}</loc></url>`).join('\n')}\n</urlset>\n`
}

const PNG_BYTES = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d, 0x49, 0x48, 0x44, 0x52, 0, 0, 0, 1, 0, 0, 0, 1])
/** A PNG header whose IHDR chunk declares the given size; enough for a dimension check. */
function pngOfSize(width: number, height: number): Uint8Array {
  const bytes = PNG_BYTES.slice()
  new DataView(bytes.buffer).setUint32(16, width)
  new DataView(bytes.buffer).setUint32(20, height)
  return bytes
}
const ICON_LINKS = '<link rel="icon" href="./favicon.svg" /><link rel="icon" type="image/png" sizes="32x32" href="./favicon-32.png" /><link rel="apple-touch-icon" href="./apple-touch-icon.png" />'
const JPEG_BYTES = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0])

/** A minimal build that passes every rule. Each case below breaks exactly one thing. */
function goodSite(): { root: string; write: (file: string, content: string | Uint8Array) => void } {
  const root = mkdtempSync(join(tmpdir(), 'qb3-site-'))
  roots.push(root)
  const write = (file: string, content: string | Uint8Array) => {
    mkdirSync(dirname(join(root, file)), { recursive: true })
    writeFileSync(join(root, file), content)
  }
  write('index.html', page('/', { body: '<p><a href="/docs">Docs</a></p>' }))
  write('docs.html', page('/docs', { body: '<img src="/previews/a.jpg" alt="A game" /><img src="/divider.png" alt="" />' }))
  write('previews/a.jpg', JPEG_BYTES)
  write('divider.png', PNG_BYTES)
  write('favicon.svg', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"></svg>')
  write('favicon-32.png', pngOfSize(32, 32))
  write('apple-touch-icon.png', pngOfSize(180, 180))
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

  it('fails when an image file holds another format than its extension says', () => {
    const site = goodSite()
    site.write('previews/b.png', JPEG_BYTES)
    expect(checkSite(site.root)).toContain('previews/b.png: bytes are jpeg, extension says png')
  })

  it('fails on an <img> without alt (alt="" passes)', () => {
    const site = goodSite()
    site.write('docs.html', page('/docs', { body: '<img src="/previews/a.jpg" />' }))
    expect(checkSite(site.root)).toContain('docs.html: <img src="/previews/a.jpg"> has no alt')
  })

  it('fails when an icon of the favicon set is missing or the wrong size', () => {
    const site = goodSite()
    rmSync(join(site.root, 'favicon-32.png'))
    site.write('apple-touch-icon.png', pngOfSize(120, 120))
    expect(checkSite(site.root)).toEqual(expect.arrayContaining([
      'favicon-32.png: missing (expected a 32×32 PNG)',
      'apple-touch-icon.png: 120×120, expected 180×180',
    ]))
  })

  it('fails when a page does not link the favicon set', () => {
    const site = goodSite()
    site.write('docs.html', page('/docs', { head: '<link rel="icon" href="./favicon.svg" />' }))
    expect(checkSite(site.root)).toEqual(expect.arrayContaining([
      'docs.html: no <link rel="icon" sizes="32x32"> to /favicon-32.png',
      'docs.html: no <link rel="apple-touch-icon"> to /apple-touch-icon.png',
    ]))
  })
})
