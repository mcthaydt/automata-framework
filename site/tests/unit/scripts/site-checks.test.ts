// @vitest-environment node

import { randomBytes } from 'node:crypto'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { withContentSecurityPolicy } from '#src/shared/html/csp'
import { checkSite } from '../../../scripts/site-checks'
import {
  BANNED_PHRASES,
  checkTargets,
  FRAMING_PHRASES,
  STANDALONE_NAMES,
  TARGETS_SENTENCE_PAGES,
} from '../../../scripts/site-checks/copy'
import {
  checkCompileWorker,
  checkEditorChunk,
  EDITOR_SOURCE,
  MAX_COMPILE_WORKER_GZIP_BYTES,
  MAX_EDITOR_CHUNK_GZIP_BYTES,
  MAX_PRELOADED_SCRIPT_BYTES,
} from '../../../scripts/site-checks/javascript'
import { writeSeoFiles } from '../../../scripts/write-seo-files'

const ORIGIN = 'https://automataframework.com'
const roots: string[] = []

const FOOTER =
  '<footer><a href="/privacy">Privacy</a><a href="/terms">Terms</a><a href="mailto:hello@example.com">hello@example.com</a></footer>'
const SECURITY_TXT = `Contact: mailto:security@example.com\nExpires: 2027-10-01T00:00:00.000Z\nPreferred-Languages: en\nCanonical: ${ORIGIN}/.well-known/security.txt\n`
const NOW = new Date('2026-10-16T00:00:00Z')
/** The four distribution targets as the site names them (ADR 0006): STANDALONE.1's check wants all four where it looks. */
const TARGETS = 'Build for the web, itch.io or Ruken; a desktop build (Tauri) is planned.'

/** A built page as finishPage leaves it: with its Content-Security-Policy, hashed from the page as written here. */
function page(
  path: string,
  { body = '<p>Real content.</p>', head = ICON_LINKS, footer = FOOTER } = {},
): string {
  return withContentSecurityPolicy(unprotectedPage(path, { body, head, footer }))
}

function unprotectedPage(
  path: string,
  { body = '<p>Real content.</p>', head = ICON_LINKS, footer = FOOTER } = {},
): string {
  return `<!doctype html><html lang="en"><head>
<title>Page</title><meta name="description" content="A page." /><meta property="og:title" content="Page" />
<link rel="canonical" href="${ORIGIN}${path}" /><meta property="og:image" content="${ORIGIN}/social.png" />${head}
</head><body><main id="main"><h1>Page</h1>${body}</main>${footer}</body></html>`
}

function sitemap(paths: string[]): string {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${paths.map((p) => `<url><loc>${ORIGIN}${p}</loc></url>`).join('\n')}\n</urlset>\n`
}

const PNG_BYTES = Uint8Array.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d, 0x49, 0x48, 0x44, 0x52, 0, 0, 0, 1, 0, 0, 0,
  1,
])
/** A PNG header whose IHDR chunk declares the given size; enough for a dimension check. */
function pngOfSize(width: number, height: number): Uint8Array {
  const bytes = PNG_BYTES.slice()
  new DataView(bytes.buffer).setUint32(16, width)
  new DataView(bytes.buffer).setUint32(20, height)
  return bytes
}
const FONT_PRELOAD =
  '<link rel="preload" as="font" type="font/woff2" crossorigin href="/_app/immutable/assets/geist-latin.woff2" />'
const FONT_CSS =
  '@font-face{font-family:Geist Variable;font-display:swap;src:url(./geist-latin.woff2) format("woff2-variations")}'
const ICON_LINKS =
  FONT_PRELOAD +
  '<link rel="icon" href="./favicon.svg" /><link rel="icon" type="image/png" sizes="32x32" href="./favicon-32.png" /><link rel="apple-touch-icon" href="./apple-touch-icon.png" />'
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
  write(
    'docs.html',
    page('/docs', { body: '<img src="/previews/a.jpg" alt="A game" /><img src="/divider.png" alt="" />' }),
  )
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

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

describe('checkSite', () => {
  it('passes a correct build', () => {
    expect(checkSite(goodSite().root, { now: NOW })).toEqual([])
  })

  it('leaves the playground out: its frame pages are not site pages and its stylesheets are not site stylesheets', () => {
    const site = goodSite()
    site.write(
      'playground/examples/core/basic-window/index.html',
      '<!doctype html><html><head><title>frame</title></head><body></body></html>',
    )
    site.write('playground/runtime/assets/define-game.css', '@font-face{font-family:X;src:url(./x.woff2)}')
    expect(checkSite(site.root, { now: NOW })).toEqual([])
    writeSeoFiles(site.root)
    expect(readFileSync(join(site.root, 'sitemap.xml'), 'utf8')).not.toContain('/playground/')
  })

  it('refuses a page that only redirects: the site cut its old pages, and an old address gets the 404 page', () => {
    const site = goodSite()
    site.write(
      'ai.html',
      page('/ai', { head: `${ICON_LINKS}<meta http-equiv="refresh" content="0; url=/docs/how-it-works" />` }),
    )
    site.write('sitemap.xml', sitemap(['/', '/ai', '/docs', '/privacy', '/terms']))
    expect(checkSite(site.root, { now: NOW })).toContain(
      'ai.html: a page that only redirects; cut pages get the 404 page',
    )
  })

  it('still reports a missing link destination', () => {
    const site = goodSite()
    site.write('docs.html', page('/docs', { body: '<a href="/nowhere">Gone</a>' }))
    expect(checkSite(site.root, { now: NOW })).toContain('docs.html: missing destination /nowhere')
  })

  it('reports an anchor that no element on the page or the linked page carries', () => {
    const site = goodSite()
    site.write(
      'docs.html',
      page('/docs', { body: '<a href="#nope">Here</a><a href="/privacy#gone">There</a>' }),
    )
    const failures = checkSite(site.root, { now: NOW })
    expect(failures).toContain('docs.html: missing anchor #nope')
    expect(failures).toContain('docs.html: missing destination anchor /privacy#gone')
  })

  it('fails on a link into the private repository while it is private, and passes it once it opens', () => {
    const site = goodSite()
    const link = '<a href="https://github.com/mcthaydt/automata-framework/blob/main/README.md">Source</a>'
    site.write('docs.html', page('/docs', { body: link }))
    expect(checkSite(site.root, { now: NOW })).toContain(
      'docs.html: links to the private repository (https://github.com/mcthaydt/automata-framework/blob/main/README.md)',
    )
    expect(checkSite(site.root, { now: NOW, repositoryPublic: true })).toEqual([])
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
    expect(checkSite(site.root, { now: NOW })).toEqual(
      expect.arrayContaining(['sitemap.xml: missing', 'robots.txt: missing']),
    )
  })

  it('fails when robots.txt does not name the sitemap', () => {
    const site = goodSite()
    site.write('robots.txt', 'User-agent: *\nAllow: /\n')
    expect(checkSite(site.root, { now: NOW })).toContain(
      'robots.txt: no Sitemap: ' + ORIGIN + '/sitemap.xml line',
    )
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
    expect(checkSite(site.root, { now: NOW })).toEqual(
      expect.arrayContaining([
        'favicon-32.png: missing (expected a 32×32 PNG)',
        'apple-touch-icon.png: 120×120, expected 180×180',
      ]),
    )
  })

  it('fails when a page does not link the favicon set', () => {
    const site = goodSite()
    site.write('docs.html', page('/docs', { head: '<link rel="icon" href="./favicon.svg" />' }))
    expect(checkSite(site.root, { now: NOW })).toEqual(
      expect.arrayContaining([
        'docs.html: no <link rel="icon" sizes="32x32"> to /favicon-32.png',
        'docs.html: no <link rel="apple-touch-icon"> to /apple-touch-icon.png',
      ]),
    )
  })

  it('fails on an @font-face without font-display: swap', () => {
    const site = goodSite()
    site.write('_app/immutable/assets/app.css', FONT_CSS.replace('font-display:swap;', ''))
    expect(checkSite(site.root, { now: NOW })).toContain(
      '_app/immutable/assets/app.css: @font-face for Geist Variable without font-display: swap',
    )
  })

  it('fails when a page or stylesheet loads a font or style from another origin', () => {
    const site = goodSite()
    site.write(
      'docs.html',
      page('/docs', {
        head: ICON_LINKS + '<link rel="stylesheet" href="https://api.fontshare.com/v2/css?f[]=satoshi" />',
      }),
    )
    site.write(
      '_app/immutable/assets/app.css',
      FONT_CSS + '@font-face{font-family:X;font-display:swap;src:url(https://fonts.gstatic.com/x.woff2)}',
    )
    expect(checkSite(site.root, { now: NOW })).toEqual(
      expect.arrayContaining([
        'docs.html: loads https://api.fontshare.com/v2/css?f[]=satoshi from another origin',
        '_app/immutable/assets/app.css: loads https://fonts.gstatic.com/x.woff2 from another origin',
      ]),
    )
  })

  it('fails when a page does not preload a self-hosted woff2', () => {
    const site = goodSite()
    site.write('docs.html', page('/docs', { head: ICON_LINKS.replace(FONT_PRELOAD, '') }))
    expect(checkSite(site.root, { now: NOW })).toContain(
      'docs.html: no <link rel="preload" as="font"> to a woff2 that a built @font-face uses',
    )
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
    site.write(
      'index.html',
      page('/', { body: '<p><a href="/docs">Docs</a></p>', head: ICON_LINKS + ENTRY_LINK }),
    )
    expect(checkSite(site.root, { now: NOW })).toEqual([
      `index.html: modulepreloads ${MAX_PRELOADED_SCRIPT_BYTES + 1} bytes of JavaScript, over the ${MAX_PRELOADED_SCRIPT_BYTES} byte budget (largest: _app/immutable/entry/start.js, ${MAX_PRELOADED_SCRIPT_BYTES + 1} bytes)`,
    ])
  })

  it('adds up the modules of a page, and resolves their links from the page’s own URL', () => {
    const site = goodSite()
    const half = Math.floor(MAX_PRELOADED_SCRIPT_BYTES / 2) + 1
    site.write('_app/immutable/entry/start.js', 'x'.repeat(half))
    site.write('_app/immutable/nodes/5.js', 'x'.repeat(half))
    const preloads =
      '<link rel="modulepreload" href="../_app/immutable/entry/start.js" /><link rel="modulepreload" href="../_app/immutable/nodes/5.js" />'
    site.write(
      'docs/editor.html',
      page('/docs/editor', { head: ICON_LINKS.replaceAll('href="./', 'href="../') + preloads }),
    )
    site.write('sitemap.xml', sitemap(['/', '/docs', '/docs/editor', '/privacy', '/terms']))
    expect(checkSite(site.root, { now: NOW })).toEqual([
      expect.stringMatching(/^docs\/editor\.html: modulepreloads \d+ bytes of JavaScript, over the/),
    ])
  })

  it('passes a page that preloads its entry and node modules within the budget', () => {
    const site = goodSite()
    site.write('_app/immutable/entry/start.js', 'x'.repeat(MAX_PRELOADED_SCRIPT_BYTES - 10))
    site.write('_app/immutable/nodes/0.js', 'x'.repeat(10))
    site.write(
      'index.html',
      page('/', {
        body: '<p><a href="/docs">Docs</a></p>',
        head: ICON_LINKS + ENTRY_LINK + '<link rel="modulepreload" href="./_app/immutable/nodes/0.js" />',
      }),
    )
    expect(checkSite(site.root, { now: NOW })).toEqual([])
  })

  it('fails when a page modulepreloads a shared chunk, however small', () => {
    const site = goodSite()
    site.write('_app/immutable/chunks/small.js', 'x')
    site.write(
      'index.html',
      page('/', {
        body: '<p><a href="/docs">Docs</a></p>',
        head: ICON_LINKS + '<link rel="modulepreload" href="./_app/immutable/chunks/small.js" />',
      }),
    )
    expect(checkSite(site.root, { now: NOW })).toEqual([
      'index.html: modulepreloads _app/immutable/chunks/small.js, a shared chunk; only the entry and node modules may be preloaded, because hints for chunks delay the first paint on a mobile connection',
    ])
  })

  it('fails when a modulepreload names a file the build does not have', () => {
    const site = goodSite()
    site.write(
      'index.html',
      page('/', {
        body: '<p><a href="/docs">Docs</a></p>',
        head: ICON_LINKS + '<link rel="modulepreload" href="./_app/immutable/entry/gone.js" />',
      }),
    )
    expect(checkSite(site.root, { now: NOW })).toEqual([
      'index.html: modulepreloads ./_app/immutable/entry/gone.js, which the build does not contain',
    ])
  })

  // QB.3j. SvelteKit's start script imports about 30 small modules and hydrates the page as soon as it runs. On a host
  // that finishes those requests before the first paint (the Owner's Mac, from a local server) Lighthouse charges all
  // of them, 350 KB, to the paint: 3.2 s on the home page against 1.7 s. `hydrateAfterFirstPaint` (src/hooks.server.ts)
  // starts them once the browser has painted, and the build must show it did.
  const START_SCRIPT = (call: string) =>
    `<script>{ const element = document.currentScript.parentElement; ${call}.then(([kit, app]) => { kit.start(app, element, {}); }); }</script>`
  const IMPORTS =
    'Promise.all([import("./_app/immutable/entry/start.js"), import("./_app/immutable/entry/app.js")])'

  it('fails when a page starts hydrating at once, before the first paint', () => {
    const site = goodSite()
    site.write('index.html', page('/', { body: `<p><a href="/docs">Docs</a></p>${START_SCRIPT(IMPORTS)}` }))
    expect(checkSite(site.root, { now: NOW })).toEqual([
      'index.html: starts hydrating at once; the start script must wait for the first paint (hydrateAfterFirstPaint in src/hooks.server.ts), because a host that finishes the module requests before painting charges all of them to the first paint',
    ])
  })

  it('passes a page whose start script waits for the first paint', () => {
    const site = goodSite()
    site.write(
      'index.html',
      page('/', {
        body: `<p><a href="/docs">Docs</a></p>${START_SCRIPT(`afterFirstPaint(() => ${IMPORTS}`).replace('.then(([kit, app]) => { kit.start(app, element, {}); }); }', '.then(([kit, app]) => { kit.start(app, element, {}); })); }')}`,
      }),
    )
    expect(checkSite(site.root, { now: NOW })).toEqual([])
  })

  it('names each page that starts at once', () => {
    const site = goodSite()
    site.write('index.html', page('/', { body: `<p><a href="/docs">Docs</a></p>${START_SCRIPT(IMPORTS)}` }))
    site.write('docs.html', page('/docs', { body: `<p>Docs</p>${START_SCRIPT(IMPORTS)}` }))
    expect(checkSite(site.root, { now: NOW }).map((failure) => failure.split(':')[0])).toEqual([
      'docs.html',
      'index.html',
    ])
  })

  // QB.4a. Every page carries its Content-Security-Policy first in <head>, allowing each of its inline scripts by hash
  // and never unsafe-inline or unsafe-eval for scripts (src/shared/html/csp.ts, added last by finishPage).
  it('fails when a page has no Content-Security-Policy', () => {
    const site = goodSite()
    site.write('index.html', unprotectedPage('/', { body: '<p><a href="/docs">Docs</a></p>' }))
    expect(checkSite(site.root, { now: NOW })).toEqual([
      'index.html: has no Content-Security-Policy first in <head> (withContentSecurityPolicy, applied last in src/shared/html/finish-page.ts)',
    ])
  })

  it('fails when an inline script changed after the policy was written', () => {
    const site = goodSite()
    const html = page('/', { body: '<p><a href="/docs">Docs</a></p><script>start()</script>' })
    site.write('index.html', html.replace('start()', 'start(1)'))
    expect(checkSite(site.root, { now: NOW })).toEqual([
      'index.html: an inline script is not allowed by the page’s Content-Security-Policy (its sha256 is not in script-src), so the browser will refuse to run it',
    ])
  })

  it('hashes the scripts as the browser parses them, apart from the hook: a CRLF the hook read raw is caught', () => {
    const site = goodSite()
    const html = unprotectedPage('/', { body: '<p><a href="/docs">Docs</a></p><script>a()\nb()</script>' })
    site.write('index.html', withContentSecurityPolicy(html).replace('a()\nb()', 'a()\r\nb()'))
    expect(checkSite(site.root, { now: NOW })).toEqual([])
    site.write('index.html', withContentSecurityPolicy(html).replace('a()\nb()', 'a()\n b()'))
    expect(checkSite(site.root, { now: NOW })).toHaveLength(1)
  })

  it('fails when script-src allows unsafe-inline or unsafe-eval', () => {
    const site = goodSite()
    site.write(
      'index.html',
      page('/', { body: '<p><a href="/docs">Docs</a></p>' }).replace(
        "script-src 'self'",
        "script-src 'self' 'unsafe-inline'",
      ),
    )
    expect(checkSite(site.root, { now: NOW })).toEqual([
      'index.html: script-src allows unsafe-inline or unsafe-eval; the quality bar (QB.4) forbids both for scripts',
    ])
  })

  it('fails when a page footer lacks privacy, terms or a contact email', () => {
    const site = goodSite()
    site.write('docs.html', page('/docs', { footer: '<footer><a href="/">Home</a></footer>' }))
    expect(checkSite(site.root, { now: NOW })).toEqual(
      expect.arrayContaining([
        'docs.html: footer has no link to /privacy',
        'docs.html: footer has no link to /terms',
        'docs.html: footer has no mailto: contact',
      ]),
    )
  })

  it('fails without a valid, unexpired security.txt', () => {
    const site = goodSite()
    rmSync(join(site.root, '.well-known/security.txt'))
    expect(checkSite(site.root, { now: NOW })).toContain('.well-known/security.txt: missing')
    site.write('.well-known/security.txt', 'Expires: 2026-01-01T00:00:00.000Z\n')
    expect(checkSite(site.root, { now: NOW })).toEqual(
      expect.arrayContaining([
        '.well-known/security.txt: no Contact: field',
        '.well-known/security.txt: Expires 2026-01-01T00:00:00.000Z is not in the future; renew it',
        `.well-known/security.txt: no Canonical: ${ORIGIN}/.well-known/security.txt`,
      ]),
    )
  })

  it('fails on a form, which the privacy page says the site does not have', () => {
    const site = goodSite()
    site.write(
      'docs.html',
      page('/docs', { body: '<form action="/subscribe"><input name="email" /></form>' }),
    )
    expect(checkSite(site.root, { now: NOW })).toContain(
      'docs.html: has a <form>; the privacy page says there are none',
    )
  })

  it.each([
    'lorem',
    'TODO',
    'coming soon',
    'seamless',
    'cutting-edge',
    'unleash',
    'supercharge',
    'revolutionize',
    'game-changer',
  ])('fails on the banned phrase %s', (phrase) => {
    expect(BANNED_PHRASES.map((banned) => banned.label)).toContain(phrase)
    const site = goodSite()
    site.write(
      'docs.html',
      page('/docs', {
        body: `<p>A ${phrase.toUpperCase() === phrase ? phrase : phrase[0].toUpperCase() + phrase.slice(1)} thing.</p>`,
      }),
    )
    expect(checkSite(site.root, { now: NOW })).toContain(`docs.html: banned phrase "${phrase}"`)
  })

  it('does not flag words that merely contain a banned phrase', () => {
    const site = goodSite()
    site.write(
      'docs.html',
      page('/docs', { body: '<p>Todos and seamlessness are fine; so is a todo list.</p>' }),
    )
    expect(checkSite(site.root, { now: NOW })).toEqual([])
  })
})

// STANDALONE.1 (Owner, 2026-10-31: "automata framework is standalone"; ADR 0006, the four targets are peers): the site
// names no reference project, casts no target as the framework's own host, and names all four targets where it says
// where a game goes. Text the site copies verbatim from the framework is the framework's to change (STANDALONE.2).
describe('checkSite: standalone and target-neutral', () => {
  it.each(['FloorFifty', 'Floor Fifty', 'The Last Light', 'Last Light', 'PixiJS3D_Experiment_001'])(
    'fails on the name %s in a page',
    (name) => {
      const site = goodSite()
      site.write('docs.html', page('/docs', { body: `<p>Built after ${name}.</p>` }))
      expect(STANDALONE_NAMES.some((entry) => entry.pattern.test(name))).toBe(true)
      expect(
        checkSite(site.root, { now: NOW }).some((problem) =>
          problem.startsWith('docs.html: names a reference project'),
        ),
      ).toBe(true)
    },
  )

  it.each([
    'Automata is a framework for modern web browsers and Ruken, the reference gaming host.',
    'Built for web browsers and the Ruken gaming platform.',
    'Ruken first: its contracts win.',
    'The Ruken SDK owns the host protocol.',
  ])('fails on Ruken-only framing: %s', (sentence) => {
    const site = goodSite()
    site.write('docs.html', page('/docs', { body: `<p>${sentence}</p>` }))
    expect(FRAMING_PHRASES.length).toBeGreaterThan(0)
    expect(
      checkSite(site.root, { now: NOW }).some((problem) =>
        problem.startsWith('docs.html: casts one target as the host'),
      ),
    ).toBe(true)
  })

  it('passes Ruken named as one target, and a Ruken-only fact scoped to it', () => {
    const site = goodSite()
    site.write(
      'docs.html',
      page('/docs', {
        body: '<p>Publish to itch.io or Ruken. On Ruken, a game’s headers come from compileHeaders.</p>',
      }),
    )
    expect(checkSite(site.root, { now: NOW })).toEqual([])
  })

  it('checks the published plain-text files too', () => {
    const site = goodSite()
    site.write('llms.txt', `# Automata\n\n${TARGETS}\nExtracted from FloorFifty.\n`)
    expect(checkSite(site.root, { now: NOW })).toContain('llms.txt: names a reference project ("FloorFifty")')
  })

  it('wants the four targets where the site says where a game goes', () => {
    expect(TARGETS_SENTENCE_PAGES).toEqual(['index.html', 'docs/how-it-works.html', 'llms.txt'])
    const site = goodSite()
    site.write('index.html', page('/', { body: `<p><a href="/docs">Docs</a></p><p>${TARGETS}</p>` }))
    site.write('docs/how-it-works.html', page('/docs/how-it-works', { body: `<p>${TARGETS}</p>` }))
    site.write('llms.txt', `# Automata\n\n${TARGETS}\n`)
    expect(checkTargets(site.root)).toEqual([])
    site.write(
      'index.html',
      page('/', { body: '<p><a href="/docs">Docs</a></p><p>Build for the web or Ruken.</p>' }),
    )
    expect(checkTargets(site.root)).toEqual([
      'index.html: does not name every distribution target (missing itch.io, desktop (Tauri))',
    ])
  })

  it('leaves text copied verbatim from the framework to the framework', () => {
    const site = goodSite()
    site.write(
      'docs.html',
      page('/docs', {
        body: '<article data-framework-copy><p>Both reference games render with Pixi 8: FloorFifty in 2D.</p></article>',
      }),
    )
    expect(checkSite(site.root, { now: NOW })).toEqual([])
  })
})

// the editor chunk loads on the first tap or focus on the code, never with a page,
// and its closure stays within 175 kB gzip. The build's Vite manifest names its file and the chunks it imports.
describe('checkEditorChunk', () => {
  const manifest = (imports: string[] = []) => ({
    [EDITOR_SOURCE]: {
      file: '_app/immutable/chunks/ed.js',
      imports: imports.length ? ['_lang.js'] : undefined,
      isDynamicEntry: true,
    },
    '_lang.js': { file: '_app/immutable/chunks/lang.js', imports: undefined },
  })
  // Random bytes do not compress: their base64 gzips to about three quarters of its length.
  const noise = (bytes: number) => randomBytes(bytes).toString('base64')

  it('holds the editor to 175 kB gzip', () => {
    expect(MAX_EDITOR_CHUNK_GZIP_BYTES).toBe(175_000)
  })

  it('passes a small editor chunk that no page loads, and reports its gzip size', () => {
    const site = goodSite()
    site.write('_app/immutable/chunks/ed.js', 'export const editor = 1')
    const result = checkEditorChunk(site.root, manifest())
    expect(result.failures).toEqual([])
    expect(result.gzipBytes).toBeGreaterThan(0)
  })

  it('counts the chunks the editor imports', () => {
    const site = goodSite()
    site.write('_app/immutable/chunks/ed.js', 'import "./lang.js"')
    site.write('_app/immutable/chunks/lang.js', noise(MAX_EDITOR_CHUNK_GZIP_BYTES * 2))
    expect(checkEditorChunk(site.root, manifest(['lang'])).failures).toEqual([
      expect.stringMatching(
        /^the editor chunk and its imports are \d+ bytes gzip, over the 175000 byte budget/,
      ),
    ])
  })

  it('fails when a page preloads or loads the editor chunk or one it imports', () => {
    const site = goodSite()
    site.write('_app/immutable/chunks/ed.js', 'import "./lang.js"')
    site.write('_app/immutable/chunks/lang.js', 'export {}')
    site.write(
      'index.html',
      page('/', {
        body: '<p><a href="/docs">Docs</a></p>',
        head: ICON_LINKS + '<link rel="modulepreload" href="./_app/immutable/chunks/lang.js" />',
      }),
    )
    expect(checkEditorChunk(site.root, manifest(['lang'])).failures).toEqual([
      'index.html: names _app/immutable/chunks/lang.js, part of the editor, which loads only on a tap or focus on the code',
    ])
  })

  it('fails when the manifest has no editor, so the check cannot pass by finding nothing', () => {
    const site = goodSite()
    expect(checkEditorChunk(site.root, {}).failures).toEqual([`the build's manifest has no ${EDITOR_SOURCE}`])
  })
})

// the compile worker (Babel and sucrase) starts with the editor, never with a page,
// and stays within 125 kB gzip. Vite emits it under `_app/immutable/workers/` and leaves it out of the manifest.
describe('checkCompileWorker', () => {
  const WORKER = '_app/immutable/workers/compile.worker-abc123.js'
  const noise = (bytes: number) => randomBytes(bytes).toString('base64')

  it('holds the worker to 125 kB gzip', () => {
    expect(MAX_COMPILE_WORKER_GZIP_BYTES).toBe(125_000)
  })

  it('passes a small worker that no page names, and reports its gzip size', () => {
    const site = goodSite()
    site.write(WORKER, 'self.onmessage = () => {}')
    const result = checkCompileWorker(site.root)
    expect(result.failures).toEqual([])
    expect(result.gzipBytes).toBeGreaterThan(0)
  })

  it('fails a worker over the budget', () => {
    const site = goodSite()
    site.write(WORKER, noise(MAX_COMPILE_WORKER_GZIP_BYTES * 2))
    expect(checkCompileWorker(site.root).failures).toEqual([
      expect.stringMatching(/^the compile worker is \d+ bytes gzip, over the 125000 byte budget/),
    ])
  })

  it('fails when a page names the worker', () => {
    const site = goodSite()
    site.write(WORKER, 'self.onmessage = () => {}')
    site.write(
      'index.html',
      page('/', {
        body: '<p><a href="/docs">Docs</a></p>',
        head: ICON_LINKS + `<link rel="modulepreload" href="./${WORKER}" />`,
      }),
    )
    expect(checkCompileWorker(site.root).failures).toEqual([
      `index.html: names ${WORKER}, the compile worker, which starts only with the editor`,
    ])
  })

  it('fails when the build has no compile worker, so the check cannot pass by finding nothing', () => {
    expect(checkCompileWorker(goodSite().root).failures).toEqual([
      'the build has no compile worker under _app/immutable/workers/',
    ])
  })
})
