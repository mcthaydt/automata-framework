/// <reference path="./jsdom.d.ts" />
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'
import { JSDOM } from 'jsdom'
import { REDIRECTS, redirectFile } from '../src/features/redirects/redirects.ts'
import { CSP_META_PREFIX, scriptHash } from '../src/lib/csp.ts'
import { SITE_ORIGIN } from '../src/lib/site.js'

/**
 * Placeholder and AI-filler phrases (quality-bar spec §4.2). Matched on whole words in each page's text, title and
 * description; TODO is matched in capitals only, so prose about a "todo list" is not flagged.
 */
export const BANNED_PHRASES: { label: string; pattern: RegExp }[] = [
  { label: 'lorem', pattern: /\blorem\b/i },
  { label: 'TODO', pattern: /\bTODO\b/ },
  { label: 'coming soon', pattern: /\bcoming soon\b/i },
  { label: 'seamless', pattern: /\bseamless(ly)?\b/i },
  { label: 'cutting-edge', pattern: /\bcutting[- ]edge\b/i },
  { label: 'unleash', pattern: /\bunleash(es|ed|ing)?\b/i },
  { label: 'supercharge', pattern: /\bsupercharg(e|es|ed|ing)\b/i },
  { label: 'revolutionize', pattern: /\brevolutioni[sz](e|es|ed|ing)\b/i },
  { label: 'game-changer', pattern: /\bgame[- ]?changer(s)?\b/i },
]

/**
 * STANDALONE.1 (Owner, 2026-10-31: "automata framework is standalone"): the reference projects the framework was
 * extracted from are not named on the site. Their record is the framework's private provenance file (STANDALONE.2).
 */
export const STANDALONE_NAMES: { label: string; pattern: RegExp }[] = [
  { label: 'FloorFifty', pattern: /\bfloor\s?fifty\b/i },
  { label: 'The Last Light', pattern: /\blast\s+light\b/i },
  { label: 'PixiJS3D_Experiment_001', pattern: /\bpixijs3d[_-]experiment/i },
]

/**
 * Wording that casts one distribution target as the framework's own host (ADR 0006: web, itch.io, Ruken and desktop
 * are peers). Ruken named as one target, or a Ruken-only fact scoped to it ("On Ruken, …"), is not framing.
 */
export const FRAMING_PHRASES: { label: string; pattern: RegExp }[] = [
  { label: 'the reference host', pattern: /\breference\s+(gaming\s+)?host\b/i },
  { label: 'web browsers and Ruken', pattern: /\bweb\s+browsers\s+and\s+(the\s+)?Ruken\b/i },
  { label: 'the Ruken platform', pattern: /\bthe\s+Ruken\s+(gaming\s+)?platform\b/i },
  { label: 'Ruken first', pattern: /\bRuken[\s-]first\b/i },
  { label: 'the Ruken SDK owns', pattern: /\bthe\s+Ruken\s+SDK\s+owns\b/i },
]

/** Where the site says where a game goes: each names all four targets (ADR 0006). */
export const TARGETS_SENTENCE_PAGES = ['index.html', 'docs/capabilities.html', 'llms.txt']
const TARGETS: { label: string; pattern: RegExp }[] = [
  { label: 'the web', pattern: /\bweb\b/i },
  { label: 'itch.io', pattern: /\bitch\.io\b/i },
  { label: 'Ruken', pattern: /\bRuken\b/ },
  { label: 'desktop (Tauri)', pattern: /\bTauri\b/ },
]

/** The plain-text files the site publishes. The framework's two (its API index) are copies it owns (DX.10a). */
const SITE_TEXT_FILES = ['llms.txt', 'llms-guides.txt']

/** A page's words, leaving out text the site shows verbatim from the framework (`data-framework-copy`). */
function ownText(doc: Document): string {
  const parts = [doc.title, doc.querySelector('meta[name="description"]')?.getAttribute('content') ?? '']
  const walker = doc.createTreeWalker(doc.body, 4 /* NodeFilter.SHOW_TEXT */)
  for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
    if (!node.parentElement?.closest('[data-framework-copy]')) parts.push(node.textContent ?? '')
  }
  return parts.join('\n')
}

/** STANDALONE.1: no reference project's name and no target cast as the host. */
export function checkStandalone(file: string, text: string): string[] {
  const failures: string[] = []
  for (const name of STANDALONE_NAMES)
    if (name.pattern.test(text)) failures.push(`${file}: names a reference project ("${name.label}")`)
  for (const phrase of FRAMING_PHRASES)
    if (phrase.pattern.test(text)) failures.push(`${file}: casts one target as the host ("${phrase.label}")`)
  return failures
}

/** STANDALONE.1: where the site says where a game goes, it names all four targets (ADR 0006). */
export function checkTargets(root: string): string[] {
  const failures: string[] = []
  for (const file of TARGETS_SENTENCE_PAGES) {
    const path = join(root, file)
    if (!existsSync(path)) {
      failures.push(`${file}: missing, so it cannot name the distribution targets`)
      continue
    }
    const raw = readFileSync(path, 'utf8')
    const text = file.endsWith('.html') ? ownText(new JSDOM(raw).window.document) : raw
    const missing = TARGETS.filter((target) => !target.pattern.test(text)).map((target) => target.label)
    if (missing.length > 0)
      failures.push(`${file}: does not name every distribution target (missing ${missing.join(', ')})`)
  }
  return failures
}

/** Folders the site copies in from the framework as built: the demo bundles and the playground (frame pages, runtime). */
const FRAMEWORK_TREES = ['demos/', 'playground/']
const fromFramework = (path: string) => FRAMEWORK_TREES.some((tree) => path.startsWith(tree))
// The cut pages' redirects are not pages: no header, no canonical, and never in the sitemap.
const REDIRECT_FILES = new Set(Object.keys(REDIRECTS).map(redirectFile))

/** The prerendered pages of a build: every HTML file except the framework's trees, the redirects and the 404 fallback. */
export function builtPages(root: string): string[] {
  return readdirSync(root, { recursive: true })
    .map(String)
    .filter((p) => p.endsWith('.html') && !fromFramework(p) && !REDIRECT_FILES.has(p) && p !== '404.html')
    .sort()
}

/**
 * Checks a static build and returns one message per failure (an empty list means it passed).
 * Each rule is a regression gate from the quality-bar spec; tests/site-checks.test.ts holds a failing fixture for each.
 */
export function checkSite(root: string, { now = new Date() }: { now?: Date } = {}): string[] {
  const pages = builtPages(root)
  const failures: string[] = []
  // Store plain ID sets: a long reference page can be linked dozens of times.
  // Rebuilding a JSDOM window for every fragment link retains too much memory.
  const pageIds = new Map<string, Set<string>>()
  const fonts = readFontFaces(root)
  failures.push(...fonts.failures)
  const canonicals = new Set<string>()
  function destinationIds(file: string): Set<string> {
    const cached = pageIds.get(file)
    if (cached) return cached
    const window = new JSDOM(readFileSync(join(root, file), 'utf8')).window
    const ids = new Set(Array.from(window.document.querySelectorAll('[id]'), (element) => element.id))
    window.close()
    pageIds.set(file, ids)
    return ids
  }
  for (const file of SITE_TEXT_FILES) {
    const path = join(root, file)
    if (existsSync(path)) failures.push(...checkStandalone(file, readFileSync(path, 'utf8')))
  }
  for (const file of pages) {
    const html = readFileSync(join(root, file), 'utf8')
    const window = new JSDOM(html).window
    const doc = window.document
    pageIds.set(file, new Set(Array.from(doc.querySelectorAll('[id]'), (element) => element.id)))
    for (const selector of [
      'title',
      'h1',
      'main#main',
      'meta[name="description"]',
      'meta[property="og:title"]',
      'link[rel="canonical"]',
    ]) {
      if (doc.querySelectorAll(selector).length !== 1) failures.push(file + ': expected one ' + selector)
    }
    const text = [
      doc.title,
      doc.querySelector('meta[name="description"]')?.getAttribute('content') ?? '',
      doc.body.textContent ?? '',
    ].join('\n')
    for (const banned of BANNED_PHRASES)
      if (banned.pattern.test(text)) failures.push(`${file}: banned phrase "${banned.label}"`)
    failures.push(...checkStandalone(file, ownText(doc)))
    failures.push(
      ...checkIconLinks(file, doc),
      ...checkPageResources(file, doc, fonts.urls),
      ...checkPreloadedScripts(root, file, doc),
      ...checkHydrationStart(file, html),
      ...checkContentSecurityPolicy(file, html, doc),
      ...checkFooter(file, doc),
    )
    for (const image of doc.querySelectorAll('img')) {
      // Decorative images say so with alt=""; a missing attribute is always a defect.
      if (!image.hasAttribute('alt'))
        failures.push(`${file}: <img src="${image.getAttribute('src')}"> has no alt`)
    }
    const canonical = doc.querySelector('link[rel="canonical"]')?.getAttribute('href') ?? ''
    if (!canonical.startsWith(SITE_ORIGIN + '/')) failures.push(file + ': wrong canonical origin')
    canonicals.add(canonical)
    if (
      doc.querySelector('meta[property="og:image"]')?.getAttribute('content') !==
      SITE_ORIGIN + '/social.png'
    )
      failures.push(file + ': wrong social image')
    for (const anchor of doc.querySelectorAll('a[href]')) {
      const href = anchor.getAttribute('href')!
      if (href.startsWith('#')) {
        if (!doc.getElementById(href.slice(1))) failures.push(file + ': missing anchor ' + href)
        continue
      }
      if (!href.startsWith('/')) continue
      const url = new URL(href, SITE_ORIGIN)
      const path = url.pathname === '/' ? 'index.html' : url.pathname.slice(1)
      const target = [path, path + '.html', join(path, 'index.html')].find((p) => existsSync(join(root, p)))
      if (!target) failures.push(file + ': missing destination ' + href)
      else if (url.hash && target.endsWith('.html')) {
        if (!destinationIds(target).has(url.hash.slice(1)))
          failures.push(file + ': missing destination anchor ' + href)
      }
    }
    window.close()
  }
  failures.push(
    ...checkSeoFiles(root, canonicals),
    ...checkImageFormats(root),
    ...checkIconFiles(root),
    ...checkSecurityTxt(root, now),
  )
  return failures
}

/** sitemap.xml lists exactly the canonical URL of every page, and robots.txt points at it (spec F-3). */
function checkSeoFiles(root: string, canonicals: Set<string>): string[] {
  const failures: string[] = []
  const sitemapPath = join(root, 'sitemap.xml')
  if (!existsSync(sitemapPath)) failures.push('sitemap.xml: missing')
  else {
    const listed = new Set(
      Array.from(readFileSync(sitemapPath, 'utf8').matchAll(/<loc>([^<]+)<\/loc>/g), (match) => match[1]),
    )
    for (const url of canonicals) if (!listed.has(url)) failures.push('sitemap.xml: missing ' + url)
    for (const url of listed) if (!canonicals.has(url)) failures.push('sitemap.xml: no page for ' + url)
  }
  const robotsPath = join(root, 'robots.txt')
  if (!existsSync(robotsPath)) failures.push('robots.txt: missing')
  else if (!readFileSync(robotsPath, 'utf8').split('\n').includes(`Sitemap: ${SITE_ORIGIN}/sitemap.xml`)) {
    failures.push(`robots.txt: no Sitemap: ${SITE_ORIGIN}/sitemap.xml line`)
  }
  return failures
}

const IMAGE_EXTENSIONS: Record<string, string> = {
  png: 'png',
  jpg: 'jpeg',
  jpeg: 'jpeg',
  webp: 'webp',
  gif: 'gif',
  avif: 'avif',
  svg: 'svg',
}

/** Names an image format from its leading bytes, or 'unknown'. */
export function sniffImage(bytes: Uint8Array): string {
  const ascii = (start: number, end: number) => String.fromCharCode(...bytes.subarray(start, end))
  if (bytes[0] === 0x89 && ascii(1, 4) === 'PNG') return 'png'
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpeg'
  if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'webp'
  if (ascii(0, 4) === 'GIF8') return 'gif'
  if (ascii(4, 8) === 'ftyp' && ascii(8, 12).startsWith('avi')) return 'avif'
  if (/<svg[\s>]/.test(new TextDecoder().decode(bytes.subarray(0, 1024)))) return 'svg'
  return 'unknown'
}

/** Every image in the build holds the format its extension names (spec F-2: JPEG data was shipped as .png). */
function checkImageFormats(root: string): string[] {
  const failures: string[] = []
  for (const file of readdirSync(root, { recursive: true }).map(String).sort()) {
    const expected = IMAGE_EXTENSIONS[file.split('.').pop()!.toLowerCase()]
    if (!expected) continue
    const actual = sniffImage(readFileSync(join(root, file)))
    if (actual !== expected)
      failures.push(`${file}: bytes are ${actual}, extension says ${file.split('.').pop()}`)
  }
  return failures
}

/** The URL a built page is served at: `index.html` is `/`, `docs/faq.html` is `/docs/faq`. */
export function pageUrl(file: string): URL {
  const path =
    file === 'index.html'
      ? ''
      : file.endsWith('/index.html')
        ? file.slice(0, -'index.html'.length)
        : file.replace(/\.html$/, '')
  return new URL('/' + path, SITE_ORIGIN)
}

const ICONS = [
  {
    file: 'favicon-32.png',
    size: 32,
    selector: 'link[rel="icon"][sizes="32x32"]',
    label: '<link rel="icon" sizes="32x32">',
  },
  {
    file: 'apple-touch-icon.png',
    size: 180,
    selector: 'link[rel="apple-touch-icon"]',
    label: '<link rel="apple-touch-icon">',
  },
]

/** Every page links the PNG icons beside the SVG favicon (spec §4.2 favicon set). */
function checkIconLinks(file: string, doc: Document): string[] {
  const failures: string[] = []
  for (const icon of ICONS) {
    // SvelteKit writes %sveltekit.assets% as a relative path (./ or ../), so resolve it against the page's URL.
    const linked = Array.from(doc.querySelectorAll(icon.selector)).some(
      (link) => new URL(link.getAttribute('href') ?? '', pageUrl(file)).pathname === '/' + icon.file,
    )
    if (!linked) failures.push(`${file}: no ${icon.label} to /${icon.file}`)
  }
  return failures
}

/** The PNG icons exist at their exact sizes, read from the IHDR chunk. */
function checkIconFiles(root: string): string[] {
  const failures: string[] = []
  for (const icon of ICONS) {
    const path = join(root, icon.file)
    if (!existsSync(path)) {
      failures.push(`${icon.file}: missing (expected a ${icon.size}×${icon.size} PNG)`)
      continue
    }
    const bytes = readFileSync(path)
    if (sniffImage(bytes) !== 'png') {
      failures.push(`${icon.file}: not a PNG`)
      continue
    }
    const width = bytes.readUInt32BE(16)
    const height = bytes.readUInt32BE(20)
    if (width !== icon.size || height !== icon.size)
      failures.push(`${icon.file}: ${width}×${height}, expected ${icon.size}×${icon.size}`)
  }
  return failures
}

/** Assets a page loads itself (not links it offers): a third-party one is a privacy leak and a slower first paint. */
const LOADED_RESOURCES =
  'link[rel~="stylesheet"][href], link[rel~="preload"][href], link[rel~="modulepreload"][href], link[rel~="icon"][href], link[rel~="apple-touch-icon"][href], script[src], img[src], iframe[src], source[src], video[src], audio[src]'

function isOtherOrigin(reference: string): boolean {
  return /^(https?:)?\/\//i.test(reference) && new URL(reference, SITE_ORIGIN).origin !== SITE_ORIGIN
}

/** No page loads a resource from another origin, and each preloads a self-hosted font face (spec F-5). */
function checkPageResources(file: string, doc: Document, fontUrls: Set<string>): string[] {
  const failures: string[] = []
  for (const element of doc.querySelectorAll(LOADED_RESOURCES)) {
    const reference = element.getAttribute('href') ?? element.getAttribute('src')!
    if (isOtherOrigin(reference)) failures.push(`${file}: loads ${reference} from another origin`)
  }
  const preloadsFont = Array.from(
    doc.querySelectorAll('link[rel="preload"][as="font"][type="font/woff2"][crossorigin]'),
  ).some((link) => fontUrls.has(new URL(link.getAttribute('href') ?? '', pageUrl(file)).pathname))
  if (!preloadsFont)
    failures.push(`${file}: no <link rel="preload" as="font"> to a woff2 that a built @font-face uses`)
  return failures
}

/**
 * The most JavaScript, as built (before compression), that one page may ask the browser to modulepreload (QB.3h, QB.3j).
 * Preloaded modules start downloading before any script has run, so on a mobile connection they compete with the
 * stylesheet, font and image the first paint waits for. The home page and the gallery once preloaded 380 KB of example
 * sources and had a 3.2 s LCP; then the 26 to 29 hints for shared chunks (250 KB) cost every page 0.5 to 0.9 s of first
 * paint. Only the entry and node modules are preloaded now (`src/lib/preloads.ts`); the heaviest page has 35 KB of them,
 * which this leaves room for. Raise it only with a Lighthouse run that still meets the LCP budget.
 */
export const MAX_PRELOADED_SCRIPT_BYTES = 48_000

/** The folders whose modules a page may preload: the app's entry points and the page's own nodes, not shared chunks. */
const PRELOADABLE_MODULES = /^_app\/immutable\/(?:entry|nodes)\//

/**
 * A page that hydrates starts after the first paint (QB.3j). SvelteKit's start script imports about 30 small modules and
 * hydrates at once; on a host that finishes those requests before it paints, Lighthouse charges all of them (350 KB) to
 * the first paint. `hydrateAfterFirstPaint` (src/lib/hydration.ts, applied in src/hooks.server.ts) wraps the imports in
 * `afterFirstPaint(`; a page that imports its entry modules without it was not transformed (a SvelteKit upgrade can
 * change the script's shape, and the transform then leaves it alone).
 */
function checkHydrationStart(file: string, html: string): string[] {
  const hydrates = /import\("[^"]*\/entry\/start\.[^"]*"\)/.test(html)
  if (!hydrates || html.includes('afterFirstPaint(() =>')) return []
  return [
    `${file}: starts hydrating at once; the start script must wait for the first paint (hydrateAfterFirstPaint in src/hooks.server.ts), because a host that finishes the module requests before painting charges all of them to the first paint`,
  ]
}

/**
 * Every page carries its Content-Security-Policy first in <head> (QB.4a): a `<meta>` policy applies only to what comes
 * after it. Its script-src allows each inline script by the sha256 of its text and never `unsafe-inline` or
 * `unsafe-eval`; a script rewritten after the policy was written would be refused by the browser.
 */
export function checkContentSecurityPolicy(file: string, html: string, doc: Document): string[] {
  const head = /<head(?:\s[^>]*)?>/.exec(html)
  const metaAt = head ? head.index + head[0].length : -1
  if (!head || !html.startsWith(CSP_META_PREFIX, metaAt)) {
    return [
      `${file}: has no Content-Security-Policy first in <head> (withContentSecurityPolicy, applied last in src/lib/finish-page.ts)`,
    ]
  }
  const start = metaAt + CSP_META_PREFIX.length
  const policy = html.slice(start, html.indexOf('"', start))
  const scriptSrc =
    policy
      .split(';')
      .map((part) => part.trim())
      .find((part) => part.startsWith('script-src ')) ?? ''
  const failures: string[] = []
  if (/'unsafe-(inline|eval)'/.test(scriptSrc))
    failures.push(
      `${file}: script-src allows unsafe-inline or unsafe-eval; the quality bar (QB.4) forbids both for scripts`,
    )
  const allowed = new Set(scriptSrc.split(/\s+/))
  // Hashed from the parsed page, not with csp.ts's own reading of the HTML, so a script the hook misread is caught.
  const inline = Array.from(doc.querySelectorAll('script:not([src])'), (script) =>
    scriptHash(script.textContent ?? ''),
  )
  if (inline.some((hash) => !allowed.has(hash))) {
    failures.push(
      `${file}: an inline script is not allowed by the page’s Content-Security-Policy (its sha256 is not in script-src), so the browser will refuse to run it`,
    )
  }
  return failures
}

/** A page's modulepreload links exist in the build, are entry or node modules, and together stay within MAX_PRELOADED_SCRIPT_BYTES. */
function checkPreloadedScripts(root: string, file: string, doc: Document): string[] {
  const failures: string[] = []
  const modules: { path: string; bytes: number }[] = []
  for (const link of doc.querySelectorAll('link[rel~="modulepreload"][href]')) {
    const href = link.getAttribute('href')!
    if (isOtherOrigin(href)) continue
    const path = new URL(href, pageUrl(file)).pathname.slice(1)
    if (!existsSync(join(root, path)))
      failures.push(`${file}: modulepreloads ${href}, which the build does not contain`)
    else if (!PRELOADABLE_MODULES.test(path))
      failures.push(
        `${file}: modulepreloads ${path}, a shared chunk; only the entry and node modules may be preloaded, because hints for chunks delay the first paint on a mobile connection`,
      )
    else modules.push({ path, bytes: statSync(join(root, path)).size })
  }
  const total = modules.reduce((sum, module) => sum + module.bytes, 0)
  if (total > MAX_PRELOADED_SCRIPT_BYTES) {
    const largest = modules.reduce((a, b) => (b.bytes > a.bytes ? b : a))
    failures.push(
      `${file}: modulepreloads ${total} bytes of JavaScript, over the ${MAX_PRELOADED_SCRIPT_BYTES} byte budget (largest: ${largest.path}, ${largest.bytes} bytes)`,
    )
  }
  return failures
}

/**
 * Reads the site's built stylesheets (not the demo bundles or the playground, which are framework builds with their own fonts):
 * every @font-face must use font-display: swap, and no stylesheet may load from another origin.
 * Returns the site paths of the woff2 files the font faces use, for the preload check.
 */
function readFontFaces(root: string): { urls: Set<string>; failures: string[] } {
  const urls = new Set<string>()
  const failures: string[] = []
  const stylesheets = readdirSync(root, { recursive: true })
    .map(String)
    .filter((p) => p.endsWith('.css') && !fromFramework(p))
    .sort()
  for (const file of stylesheets) {
    const css = readFileSync(join(root, file), 'utf8')
    for (const [, reference] of css.matchAll(
      /url\(\s*["']?([^"')]+)["']?\s*\)|@import\s+["']([^"']+)["']/g,
    )) {
      if (reference && isOtherOrigin(reference))
        failures.push(`${file}: loads ${reference} from another origin`)
    }
    for (const [, body] of css.matchAll(/@font-face\s*{([^}]*)}/g)) {
      const family = /font-family:\s*["']?([^;"']+)/.exec(body)?.[1]?.trim() ?? 'an unnamed family'
      if (!/font-display:\s*swap/.test(body))
        failures.push(`${file}: @font-face for ${family} without font-display: swap`)
      for (const [, source] of body.matchAll(/url\(\s*["']?([^"')]+\.woff2)["']?\s*\)/g)) {
        if (!isOtherOrigin(source)) urls.add(new URL(source, new URL('/' + file, SITE_ORIGIN)).pathname)
      }
    }
  }
  return { urls, failures }
}

/** Every page's footer reaches the privacy and terms pages and a contact email (spec F-4, QB-D3). */
function checkFooter(file: string, doc: Document): string[] {
  const failures: string[] = []
  const hrefs = Array.from(doc.querySelectorAll('footer a[href]'), (anchor) => anchor.getAttribute('href')!)
  for (const path of ['/privacy', '/terms'])
    if (!hrefs.includes(path)) failures.push(`${file}: footer has no link to ${path}`)
  if (!hrefs.some((href) => href.startsWith('mailto:')))
    failures.push(`${file}: footer has no mailto: contact`)
  // The privacy page promises no forms; a newsletter or contact form must update it (and its spec trigger) first.
  if (doc.querySelector('form')) failures.push(`${file}: has a <form>; the privacy page says there are none`)
  return failures
}

/** RFC 9116: a Contact, an Expires in the future (renewed at least yearly) and the Canonical URL (spec F-4). */
function checkSecurityTxt(root: string, now: Date): string[] {
  const file = '.well-known/security.txt'
  const path = join(root, file)
  if (!existsSync(path)) return [file + ': missing']
  const fields = new Map<string, string[]>()
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const match = /^([A-Za-z-]+):\s*(.+)$/.exec(line.trim())
    if (match)
      fields.set(match[1].toLowerCase(), [...(fields.get(match[1].toLowerCase()) ?? []), match[2].trim()])
  }
  const failures: string[] = []
  if (!fields.get('contact')?.length) failures.push(file + ': no Contact: field')
  const expires = fields.get('expires')?.[0]
  if (!expires || Number.isNaN(Date.parse(expires))) failures.push(file + ': no valid Expires: field')
  else if (Date.parse(expires) <= now.getTime())
    failures.push(`${file}: Expires ${expires} is not in the future; renew it`)
  const canonical = `${SITE_ORIGIN}/${file}`
  if (!fields.get('canonical')?.includes(canonical)) failures.push(`${file}: no Canonical: ${canonical}`)
  return failures
}

/** The editor's source, as the build's Vite manifest keys it. */
export const EDITOR_SOURCE = 'src/lib/playground/editor.ts'
/** The editor chunk and the chunks it imports, gzipped (playground spec §10.1). */
export const MAX_EDITOR_CHUNK_GZIP_BYTES = 175_000

interface ManifestChunk {
  readonly file: string
  readonly imports?: readonly string[]
}

/**
 * The editor loads on the first tap or focus on an example's code (spec F2), so no page may name its chunk or the
 * chunks it imports, and together they stay within MAX_EDITOR_CHUNK_GZIP_BYTES. `manifest` is the build's
 * `.vite/manifest.json`, which maps the editor's source to its file.
 */
export function checkEditorChunk(
  root: string,
  manifest: Record<string, ManifestChunk>,
): { failures: string[]; gzipBytes: number } {
  if (!manifest[EDITOR_SOURCE])
    return { failures: [`the build's manifest has no ${EDITOR_SOURCE}`], gzipBytes: 0 }
  const files = new Set<string>()
  const visit = (key: string) => {
    const chunk = manifest[key]
    if (!chunk || files.has(chunk.file)) return
    files.add(chunk.file)
    for (const imported of chunk.imports ?? []) visit(imported)
  }
  visit(EDITOR_SOURCE)
  const failures: string[] = []
  const gzipBytes = [...files].reduce(
    (sum, file) => sum + gzipSync(readFileSync(join(root, file)), { level: 9 }).length,
    0,
  )
  if (gzipBytes > MAX_EDITOR_CHUNK_GZIP_BYTES)
    failures.push(
      `the editor chunk and its imports are ${gzipBytes} bytes gzip, over the ${MAX_EDITOR_CHUNK_GZIP_BYTES} byte budget`,
    )
  for (const page of builtPages(root)) {
    const html = readFileSync(join(root, page), 'utf8')
    for (const file of files)
      if (html.includes(file))
        failures.push(
          `${page}: names ${file}, part of the editor, which loads only on a tap or focus on the code`,
        )
  }
  return { failures, gzipBytes }
}

/** The compile worker's gzip budget: `@babel/parser` and sucrase (spec §10.1). */
export const MAX_COMPILE_WORKER_GZIP_BYTES = 125_000
const WORKERS_DIR = '_app/immutable/workers'

/**
 * The compile worker (WEB.PLAY.7) starts with the editor, so no page names it, and it stays within
 * MAX_COMPILE_WORKER_GZIP_BYTES. Vite emits a worker under `_app/immutable/workers/` and leaves it out of the manifest,
 * so it is found by its name.
 */
export function checkCompileWorker(root: string): { failures: string[]; gzipBytes: number } {
  const dir = join(root, WORKERS_DIR)
  const files = existsSync(dir)
    ? readdirSync(dir)
        .filter((name) => /^compile\.worker-[\w-]+\.js$/.test(name))
        .map((name) => `${WORKERS_DIR}/${name}`)
    : []
  if (files.length === 0)
    return { failures: [`the build has no compile worker under ${WORKERS_DIR}/`], gzipBytes: 0 }
  const failures: string[] = []
  const gzipBytes = Math.max(
    ...files.map((file) => gzipSync(readFileSync(join(root, file)), { level: 9 }).length),
  )
  if (gzipBytes > MAX_COMPILE_WORKER_GZIP_BYTES)
    failures.push(
      `the compile worker is ${gzipBytes} bytes gzip, over the ${MAX_COMPILE_WORKER_GZIP_BYTES} byte budget`,
    )
  for (const page of builtPages(root)) {
    const html = readFileSync(join(root, page), 'utf8')
    for (const file of files)
      if (html.includes(file))
        failures.push(`${page}: names ${file}, the compile worker, which starts only with the editor`)
  }
  return { failures, gzipBytes }
}
