// @vitest-environment node
import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { BANNED_PHRASES, MAX_PRELOADED_SCRIPT_BYTES, checkSite } from '../scripts/site-checks'
import { writeSeoFiles } from '../scripts/write-seo-files'

const ORIGIN = 'https://automata.ruken.com'
const roots: string[] = []

const FOOTER = '<footer><a href="/privacy">Privacy</a><a href="/terms">Terms</a><a href="mailto:hello@example.com">hello@example.com</a></footer>'
const SECURITY_TXT = `Contact: mailto:security@example.com\nExpires: 2027-10-01T00:00:00.000Z\nPreferred-Languages: en\nCanonical: ${ORIGIN}/.well-known/security.txt\n`
const NOW = new Date('2026-10-16T00:00:00Z')

function page(path: string, { body = '<p>Real content.</p>', head = ICON_LINKS, footer = FOOTER } = {}): string {
  return `<!doctype html><html lang="en"><head>
<title>Page</title><meta name="description" content="A page." /><meta property="og:title" content="Page" />
<link rel="canonical" href="${ORIGIN}${path}" /><meta property="og:image" content="${ORIGIN}/social.png" />${head}
</head><body><main id="main"><h1>Page</h1>${body}</main>${footer}</body></html>`
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
const FONT_PRELOAD = '<link rel="preload" as="font" type="font/woff2" crossorigin href="/_app/immutable/assets/geist-latin.woff2" />'
const FONT_CSS = '@font-face{font-family:Geist Variable;font-display:swap;src:url(./geist-latin.woff2) format("woff2-variations")}'
const ICON_LINKS = FONT_PRELOAD + '<link rel="icon" href="./favicon.svg" /><link rel="icon" type="image/png" sizes="32x32" href="./favicon-32.png" /><link rel="apple-touch-icon" href="./apple-touch-icon.png" />'
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
  write('privacy.html', page('/privacy'))
  write('terms.html', page('/terms'))
  write('.well-known/security.txt', SECURITY_TXT)
  write('docs.html', page('/docs', { body: '<img src="/previews/a.jpg" alt="A game" /><img src="/divider.png" alt="" />' }))
  write('previews/a.jpg', JPEG_BYTES)
  write('divider.png', PNG_BYTES)
  write('favicon.svg', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"></svg>')
  write('favicon-32.png', pngOfSize(32, 32))
  write('apple-touch-icon.png', pngOfSize(180, 180))
  write('_app/immutable/assets/app.css', FONT_CSS)
  write('_app/immutable/assets/geist-latin.woff2', 'wOF2')
  write('sitemap.xml', sitemap(['/', '/docs', '/privacy', '/terms']))
  write('robots.txt', `User-agent: *\nAllow: /\nSitemap: ${ORIGIN}/sitemap.xml\n`)
  return { root, write }
}

afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }) })

describe('checkSite', () => {
  it('passes a correct build', () => {
    expect(checkSite(goodSite().root, { now: NOW })).toEqual([])
  })

  it('leaves the playground out: its frame pages are not site pages and its stylesheets are not site stylesheets', () => {
    const site = goodSite()
    site.write('playground/examples/core/basic-window/index.html', '<!doctype html><html><head><title>frame</title></head><body></body></html>')
    site.write('playground/runtime/assets/define-game.css', '@font-face{font-family:X;src:url(./x.woff2)}')
    expect(checkSite(site.root, { now: NOW })).toEqual([])
    writeSeoFiles(site.root)
    expect(readFileSync(join(site.root, 'sitemap.xml'), 'utf8')).not.toContain('/playground/')
  })

  it('still reports a missing link destination', () => {
    const site = goodSite()
    site.write('docs.html', page('/docs', { body: '<a href="/nowhere">Gone</a>' }))
    expect(checkSite(site.root, { now: NOW })).toContain('docs.html: missing destination /nowhere')
  })

  it('fails when a page is missing from the sitemap', () => {
    const site = goodSite()
    site.write('sitemap.xml', sitemap(['/', '/privacy', '/terms']))
    expect(checkSite(site.root, { now: NOW })).toContain('sitemap.xml: missing ' + ORIGIN + '/docs')
  })

  it('fails when the sitemap lists a URL with no page', () => {
    const site = goodSite()
    site.write('sitemap.xml', sitemap(['/', '/docs', '/privacy', '/terms', '/gone']))
    expect(checkSite(site.root, { now: NOW })).toContain('sitemap.xml: no page for ' + ORIGIN + '/gone')
  })

  it('fails without a sitemap or robots.txt', () => {
    const site = goodSite()
    rmSync(join(site.root, 'sitemap.xml'))
    rmSync(join(site.root, 'robots.txt'))
    expect(checkSite(site.root, { now: NOW })).toEqual(expect.arrayContaining(['sitemap.xml: missing', 'robots.txt: missing']))
  })

  it('fails when robots.txt does not name the sitemap', () => {
    const site = goodSite()
    site.write('robots.txt', 'User-agent: *\nAllow: /\n')
    expect(checkSite(site.root, { now: NOW })).toContain('robots.txt: no Sitemap: ' + ORIGIN + '/sitemap.xml line')
  })

  it('writeSeoFiles generates a sitemap and robots.txt that pass', () => {
    const site = goodSite()
    rmSync(join(site.root, 'sitemap.xml'))
    rmSync(join(site.root, 'robots.txt'))
    writeSeoFiles(site.root)
    expect(checkSite(site.root, { now: NOW })).toEqual([])
  })

  it('fails when an image file holds another format than its extension says', () => {
    const site = goodSite()
    site.write('previews/b.png', JPEG_BYTES)
    expect(checkSite(site.root, { now: NOW })).toContain('previews/b.png: bytes are jpeg, extension says png')
  })

  it('fails on an <img> without alt (alt="" passes)', () => {
    const site = goodSite()
    site.write('docs.html', page('/docs', { body: '<img src="/previews/a.jpg" />' }))
    expect(checkSite(site.root, { now: NOW })).toContain('docs.html: <img src="/previews/a.jpg"> has no alt')
  })

  it('fails when an icon of the favicon set is missing or the wrong size', () => {
    const site = goodSite()
    rmSync(join(site.root, 'favicon-32.png'))
    site.write('apple-touch-icon.png', pngOfSize(120, 120))
    expect(checkSite(site.root, { now: NOW })).toEqual(expect.arrayContaining([
      'favicon-32.png: missing (expected a 32×32 PNG)',
      'apple-touch-icon.png: 120×120, expected 180×180',
    ]))
  })

  it('fails when a page does not link the favicon set', () => {
    const site = goodSite()
    site.write('docs.html', page('/docs', { head: '<link rel="icon" href="./favicon.svg" />' }))
    expect(checkSite(site.root, { now: NOW })).toEqual(expect.arrayContaining([
      'docs.html: no <link rel="icon" sizes="32x32"> to /favicon-32.png',
      'docs.html: no <link rel="apple-touch-icon"> to /apple-touch-icon.png',
    ]))
  })

  it('fails on an @font-face without font-display: swap', () => {
    const site = goodSite()
    site.write('_app/immutable/assets/app.css', FONT_CSS.replace('font-display:swap;', ''))
    expect(checkSite(site.root, { now: NOW })).toContain('_app/immutable/assets/app.css: @font-face for Geist Variable without font-display: swap')
  })

  it('fails when a page or stylesheet loads a font or style from another origin', () => {
    const site = goodSite()
    site.write('docs.html', page('/docs', { head: ICON_LINKS + '<link rel="stylesheet" href="https://api.fontshare.com/v2/css?f[]=satoshi" />' }))
    site.write('_app/immutable/assets/app.css', FONT_CSS + '@font-face{font-family:X;font-display:swap;src:url(https://fonts.gstatic.com/x.woff2)}')
    expect(checkSite(site.root, { now: NOW })).toEqual(expect.arrayContaining([
      'docs.html: loads https://api.fontshare.com/v2/css?f[]=satoshi from another origin',
      '_app/immutable/assets/app.css: loads https://fonts.gstatic.com/x.woff2 from another origin',
    ]))
  })

  it('fails when a page does not preload a self-hosted woff2', () => {
    const site = goodSite()
    site.write('docs.html', page('/docs', { head: ICON_LINKS.replace(FONT_PRELOAD, '') }))
    expect(checkSite(site.root, { now: NOW })).toContain('docs.html: no <link rel="preload" as="font"> to a woff2 that a built @font-face uses')
  })

  // QB.3h. The home page and the gallery preloaded the 380 KB chunk of example sources in the first second of a mobile load,
  // ahead of the image and styles the first paint waits for; LCP was 3.2 s against a 2.5 s target. QB.3j went further: the
  // 26 to 29 hints for shared chunks cost every page 0.5 to 0.9 s of first paint, so only the small entry and node
  // modules (35 KB built on the heaviest page) may be preloaded. The gate is on what a page asks the browser to fetch
  // before it has run any script.
  const ENTRY_LINK = '<link rel="modulepreload" href="./_app/immutable/entry/start.js" />'

  it('leaves room for the entry and node modules and not for the chunks', () => {
    expect(MAX_PRELOADED_SCRIPT_BYTES).toBe(48_000)
  })

  it('fails when a page modulepreloads more JavaScript than the budget', () => {
    const site = goodSite()
    site.write('_app/immutable/entry/start.js', 'x'.repeat(MAX_PRELOADED_SCRIPT_BYTES + 1))
    site.write('index.html', page('/', { body: '<p><a href="/docs">Docs</a></p>', head: ICON_LINKS + ENTRY_LINK }))
    expect(checkSite(site.root, { now: NOW })).toEqual([`index.html: modulepreloads ${MAX_PRELOADED_SCRIPT_BYTES + 1} bytes of JavaScript, over the ${MAX_PRELOADED_SCRIPT_BYTES} byte budget (largest: _app/immutable/entry/start.js, ${MAX_PRELOADED_SCRIPT_BYTES + 1} bytes)`])
  })

  it('adds up the modules of a page, and resolves their links from the page’s own URL', () => {
    const site = goodSite()
    const half = Math.floor(MAX_PRELOADED_SCRIPT_BYTES / 2) + 1
    site.write('_app/immutable/entry/start.js', 'x'.repeat(half))
    site.write('_app/immutable/nodes/5.js', 'x'.repeat(half))
    const preloads = '<link rel="modulepreload" href="../_app/immutable/entry/start.js" /><link rel="modulepreload" href="../_app/immutable/nodes/5.js" />'
    site.write('docs/faq.html', page('/docs/faq', { head: ICON_LINKS.replaceAll('href="./', 'href="../') + preloads }))
    site.write('sitemap.xml', sitemap(['/', '/docs', '/docs/faq', '/privacy', '/terms']))
    expect(checkSite(site.root, { now: NOW })).toEqual([expect.stringMatching(/^docs\/faq\.html: modulepreloads \d+ bytes of JavaScript, over the/)])
  })

  it('passes a page that preloads its entry and node modules within the budget', () => {
    const site = goodSite()
    site.write('_app/immutable/entry/start.js', 'x'.repeat(MAX_PRELOADED_SCRIPT_BYTES - 10))
    site.write('_app/immutable/nodes/0.js', 'x'.repeat(10))
    site.write('index.html', page('/', { body: '<p><a href="/docs">Docs</a></p>', head: ICON_LINKS + ENTRY_LINK + '<link rel="modulepreload" href="./_app/immutable/nodes/0.js" />' }))
    expect(checkSite(site.root, { now: NOW })).toEqual([])
  })

  it('fails when a page modulepreloads a shared chunk, however small', () => {
    const site = goodSite()
    site.write('_app/immutable/chunks/small.js', 'x')
    site.write('index.html', page('/', { body: '<p><a href="/docs">Docs</a></p>', head: ICON_LINKS + '<link rel="modulepreload" href="./_app/immutable/chunks/small.js" />' }))
    expect(checkSite(site.root, { now: NOW })).toEqual(['index.html: modulepreloads _app/immutable/chunks/small.js, a shared chunk; only the entry and node modules may be preloaded, because hints for chunks delay the first paint on a mobile connection'])
  })

  it('fails when a modulepreload names a file the build does not have', () => {
    const site = goodSite()
    site.write('index.html', page('/', { body: '<p><a href="/docs">Docs</a></p>', head: ICON_LINKS + '<link rel="modulepreload" href="./_app/immutable/entry/gone.js" />' }))
    expect(checkSite(site.root, { now: NOW })).toEqual(['index.html: modulepreloads ./_app/immutable/entry/gone.js, which the build does not contain'])
  })

  // QB.3j. SvelteKit's start script imports about 30 small modules and hydrates the page as soon as it runs. On a host
  // that finishes those requests before the first paint (the Owner's Mac, from a local server) Lighthouse charges all
  // of them, 350 KB, to the paint: 3.2 s on the home page against 1.7 s. `hydrateAfterFirstPaint` (src/hooks.server.ts)
  // starts them once the browser has painted, and the build must show it did.
  const START_SCRIPT = (call: string) => `<script>{ const element = document.currentScript.parentElement; ${call}.then(([kit, app]) => { kit.start(app, element, {}); }); }</script>`
  const IMPORTS = 'Promise.all([import("./_app/immutable/entry/start.js"), import("./_app/immutable/entry/app.js")])'

  it('fails when a page starts hydrating at once, before the first paint', () => {
    const site = goodSite()
    site.write('index.html', page('/', { body: `<p><a href="/docs">Docs</a></p>${START_SCRIPT(IMPORTS)}` }))
    expect(checkSite(site.root, { now: NOW })).toEqual(['index.html: starts hydrating at once; the start script must wait for the first paint (hydrateAfterFirstPaint in src/hooks.server.ts), because a host that finishes the module requests before painting charges all of them to the first paint'])
  })

  it('passes a page whose start script waits for the first paint', () => {
    const site = goodSite()
    site.write('index.html', page('/', { body: `<p><a href="/docs">Docs</a></p>${START_SCRIPT(`afterFirstPaint(() => ${IMPORTS}`).replace('.then(([kit, app]) => { kit.start(app, element, {}); }); }', '.then(([kit, app]) => { kit.start(app, element, {}); })); }')}` }))
    expect(checkSite(site.root, { now: NOW })).toEqual([])
  })

  it('names each page that starts at once', () => {
    const site = goodSite()
    site.write('index.html', page('/', { body: `<p><a href="/docs">Docs</a></p>${START_SCRIPT(IMPORTS)}` }))
    site.write('docs.html', page('/docs', { body: `<p>Docs</p>${START_SCRIPT(IMPORTS)}` }))
    expect(checkSite(site.root, { now: NOW }).map(failure => failure.split(':')[0])).toEqual(['docs.html', 'index.html'])
  })

  it('fails when a page footer lacks privacy, terms or a contact email', () => {
    const site = goodSite()
    site.write('docs.html', page('/docs', { footer: '<footer><a href="/">Home</a></footer>' }))
    expect(checkSite(site.root, { now: NOW })).toEqual(expect.arrayContaining([
      'docs.html: footer has no link to /privacy',
      'docs.html: footer has no link to /terms',
      'docs.html: footer has no mailto: contact',
    ]))
  })

  it('fails without a valid, unexpired security.txt', () => {
    const site = goodSite()
    rmSync(join(site.root, '.well-known/security.txt'))
    expect(checkSite(site.root, { now: NOW })).toContain('.well-known/security.txt: missing')
    site.write('.well-known/security.txt', 'Expires: 2026-01-01T00:00:00.000Z\n')
    expect(checkSite(site.root, { now: NOW })).toEqual(expect.arrayContaining([
      '.well-known/security.txt: no Contact: field',
      '.well-known/security.txt: Expires 2026-01-01T00:00:00.000Z is not in the future; renew it',
      `.well-known/security.txt: no Canonical: ${ORIGIN}/.well-known/security.txt`,
    ]))
  })

  it('fails on a form, which the privacy page says the site does not have', () => {
    const site = goodSite()
    site.write('docs.html', page('/docs', { body: '<form action="/subscribe"><input name="email" /></form>' }))
    expect(checkSite(site.root, { now: NOW })).toContain('docs.html: has a <form>; the privacy page says there are none')
  })

  it.each(['lorem', 'TODO', 'coming soon', 'seamless', 'cutting-edge', 'unleash', 'supercharge', 'revolutionize', 'game-changer'])('fails on the banned phrase %s', phrase => {
    expect(BANNED_PHRASES.map(banned => banned.label)).toContain(phrase)
    const site = goodSite()
    site.write('docs.html', page('/docs', { body: `<p>A ${phrase.toUpperCase() === phrase ? phrase : phrase[0].toUpperCase() + phrase.slice(1)} thing.</p>` }))
    expect(checkSite(site.root, { now: NOW })).toContain(`docs.html: banned phrase "${phrase}"`)
  })

  it('does not flag words that merely contain a banned phrase', () => {
    const site = goodSite()
    site.write('docs.html', page('/docs', { body: '<p>Todos and seamlessness are fine; so is a todo list.</p>' }))
    expect(checkSite(site.root, { now: NOW })).toEqual([])
  })
})
