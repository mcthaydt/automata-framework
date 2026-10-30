/// <reference path="./jsdom.d.ts" />
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { JSDOM } from 'jsdom'
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

/** Folders the site copies in from the framework as built: the demo bundles and the playground (frame pages, runtime). */
const FRAMEWORK_TREES = ['demos/', 'playground/']
const fromFramework = (path: string) => FRAMEWORK_TREES.some(tree => path.startsWith(tree))

/** The prerendered pages of a build: every HTML file except the framework's trees and the 404 fallback. */
export function builtPages(root: string): string[] {
  return readdirSync(root, { recursive: true }).map(String)
    .filter(p => p.endsWith('.html') && !fromFramework(p) && p !== '404.html')
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
    const ids = new Set(Array.from(window.document.querySelectorAll('[id]'), element => element.id))
    window.close()
    pageIds.set(file, ids)
    return ids
  }
  for (const file of pages) {
    const html = readFileSync(join(root, file), 'utf8')
    const window = new JSDOM(html).window
    const doc = window.document
    pageIds.set(file, new Set(Array.from(doc.querySelectorAll('[id]'), element => element.id)))
    for (const selector of ['title', 'h1', 'main#main', 'meta[name="description"]', 'meta[property="og:title"]', 'link[rel="canonical"]']) {
      if (doc.querySelectorAll(selector).length !== 1) failures.push(file + ': expected one ' + selector)
    }
    const text = [doc.title, doc.querySelector('meta[name="description"]')?.getAttribute('content') ?? '', doc.body.textContent ?? ''].join('\n')
    for (const banned of BANNED_PHRASES) if (banned.pattern.test(text)) failures.push(`${file}: banned phrase "${banned.label}"`)
    failures.push(...checkIconLinks(file, doc), ...checkPageResources(file, doc, fonts.urls), ...checkPreloadedScripts(root, file, doc), ...checkHydrationStart(file, html), ...checkFooter(file, doc))
    for (const image of doc.querySelectorAll('img')) {
      // Decorative images say so with alt=""; a missing attribute is always a defect.
      if (!image.hasAttribute('alt')) failures.push(`${file}: <img src="${image.getAttribute('src')}"> has no alt`)
    }
    const canonical = doc.querySelector('link[rel="canonical"]')?.getAttribute('href') ?? ''
    if (!canonical.startsWith(SITE_ORIGIN + '/')) failures.push(file + ': wrong canonical origin')
    canonicals.add(canonical)
    if (doc.querySelector('meta[property="og:image"]')?.getAttribute('content') !== SITE_ORIGIN + '/social.png') failures.push(file + ': wrong social image')
    for (const anchor of doc.querySelectorAll('a[href]')) {
      const href = anchor.getAttribute('href')!
      if (href.startsWith('#')) {
        if (!doc.getElementById(href.slice(1))) failures.push(file + ': missing anchor ' + href)
        continue
      }
      if (!href.startsWith('/')) continue
      const url = new URL(href, SITE_ORIGIN)
      const path = url.pathname === '/' ? 'index.html' : url.pathname.slice(1)
      const target = [path, path + '.html', join(path, 'index.html')].find(p => existsSync(join(root, p)))
      if (!target) failures.push(file + ': missing destination ' + href)
      else if (url.hash && target.endsWith('.html')) {
        if (!destinationIds(target).has(url.hash.slice(1))) failures.push(file + ': missing destination anchor ' + href)
      }
    }
    window.close()
  }
  failures.push(...checkSeoFiles(root, canonicals), ...checkImageFormats(root), ...checkIconFiles(root), ...checkSecurityTxt(root, now))
  return failures
}

/** sitemap.xml lists exactly the canonical URL of every page, and robots.txt points at it (spec F-3). */
function checkSeoFiles(root: string, canonicals: Set<string>): string[] {
  const failures: string[] = []
  const sitemapPath = join(root, 'sitemap.xml')
  if (!existsSync(sitemapPath)) failures.push('sitemap.xml: missing')
  else {
    const listed = new Set(Array.from(readFileSync(sitemapPath, 'utf8').matchAll(/<loc>([^<]+)<\/loc>/g), match => match[1]))
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

const IMAGE_EXTENSIONS: Record<string, string> = { png: 'png', jpg: 'jpeg', jpeg: 'jpeg', webp: 'webp', gif: 'gif', avif: 'avif', svg: 'svg' }

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
    if (actual !== expected) failures.push(`${file}: bytes are ${actual}, extension says ${file.split('.').pop()}`)
  }
  return failures
}

/** The URL a built page is served at: `index.html` is `/`, `docs/faq.html` is `/docs/faq`. */
export function pageUrl(file: string): URL {
  const path = file === 'index.html' ? '' : file.endsWith('/index.html') ? file.slice(0, -'index.html'.length) : file.replace(/\.html$/, '')
  return new URL('/' + path, SITE_ORIGIN)
}

const ICONS = [
  { file: 'favicon-32.png', size: 32, selector: 'link[rel="icon"][sizes="32x32"]', label: '<link rel="icon" sizes="32x32">' },
  { file: 'apple-touch-icon.png', size: 180, selector: 'link[rel="apple-touch-icon"]', label: '<link rel="apple-touch-icon">' },
]

/** Every page links the PNG icons beside the SVG favicon (spec §4.2 favicon set). */
function checkIconLinks(file: string, doc: Document): string[] {
  const failures: string[] = []
  for (const icon of ICONS) {
    // SvelteKit writes %sveltekit.assets% as a relative path (./ or ../), so resolve it against the page's URL.
    const linked = Array.from(doc.querySelectorAll(icon.selector))
      .some(link => new URL(link.getAttribute('href') ?? '', pageUrl(file)).pathname === '/' + icon.file)
    if (!linked) failures.push(`${file}: no ${icon.label} to /${icon.file}`)
  }
  return failures
}

/** The PNG icons exist at their exact sizes, read from the IHDR chunk. */
function checkIconFiles(root: string): string[] {
  const failures: string[] = []
  for (const icon of ICONS) {
    const path = join(root, icon.file)
    if (!existsSync(path)) { failures.push(`${icon.file}: missing (expected a ${icon.size}×${icon.size} PNG)`); continue }
    const bytes = readFileSync(path)
    if (sniffImage(bytes) !== 'png') { failures.push(`${icon.file}: not a PNG`); continue }
    const width = bytes.readUInt32BE(16)
    const height = bytes.readUInt32BE(20)
    if (width !== icon.size || height !== icon.size) failures.push(`${icon.file}: ${width}×${height}, expected ${icon.size}×${icon.size}`)
  }
  return failures
}

/** Assets a page loads itself (not links it offers): a third-party one is a privacy leak and a slower first paint. */
const LOADED_RESOURCES = 'link[rel~="stylesheet"][href], link[rel~="preload"][href], link[rel~="modulepreload"][href], link[rel~="icon"][href], link[rel~="apple-touch-icon"][href], script[src], img[src], iframe[src], source[src], video[src], audio[src]'

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
  const preloadsFont = Array.from(doc.querySelectorAll('link[rel="preload"][as="font"][type="font/woff2"][crossorigin]'))
    .some(link => fontUrls.has(new URL(link.getAttribute('href') ?? '', pageUrl(file)).pathname))
  if (!preloadsFont) failures.push(`${file}: no <link rel="preload" as="font"> to a woff2 that a built @font-face uses`)
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
  return [`${file}: starts hydrating at once; the start script must wait for the first paint (hydrateAfterFirstPaint in src/hooks.server.ts), because a host that finishes the module requests before painting charges all of them to the first paint`]
}

/** A page's modulepreload links exist in the build, are entry or node modules, and together stay within MAX_PRELOADED_SCRIPT_BYTES. */
function checkPreloadedScripts(root: string, file: string, doc: Document): string[] {
  const failures: string[] = []
  const modules: { path: string; bytes: number }[] = []
  for (const link of doc.querySelectorAll('link[rel~="modulepreload"][href]')) {
    const href = link.getAttribute('href')!
    if (isOtherOrigin(href)) continue
    const path = new URL(href, pageUrl(file)).pathname.slice(1)
    if (!existsSync(join(root, path))) failures.push(`${file}: modulepreloads ${href}, which the build does not contain`)
    else if (!PRELOADABLE_MODULES.test(path)) failures.push(`${file}: modulepreloads ${path}, a shared chunk; only the entry and node modules may be preloaded, because hints for chunks delay the first paint on a mobile connection`)
    else modules.push({ path, bytes: statSync(join(root, path)).size })
  }
  const total = modules.reduce((sum, module) => sum + module.bytes, 0)
  if (total > MAX_PRELOADED_SCRIPT_BYTES) {
    const largest = modules.reduce((a, b) => (b.bytes > a.bytes ? b : a))
    failures.push(`${file}: modulepreloads ${total} bytes of JavaScript, over the ${MAX_PRELOADED_SCRIPT_BYTES} byte budget (largest: ${largest.path}, ${largest.bytes} bytes)`)
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
  const stylesheets = readdirSync(root, { recursive: true }).map(String).filter(p => p.endsWith('.css') && !fromFramework(p)).sort()
  for (const file of stylesheets) {
    const css = readFileSync(join(root, file), 'utf8')
    for (const [, reference] of css.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)|@import\s+["']([^"']+)["']/g)) {
      if (reference && isOtherOrigin(reference)) failures.push(`${file}: loads ${reference} from another origin`)
    }
    for (const [, body] of css.matchAll(/@font-face\s*{([^}]*)}/g)) {
      const family = /font-family:\s*["']?([^;"']+)/.exec(body)?.[1]?.trim() ?? 'an unnamed family'
      if (!/font-display:\s*swap/.test(body)) failures.push(`${file}: @font-face for ${family} without font-display: swap`)
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
  const hrefs = Array.from(doc.querySelectorAll('footer a[href]'), anchor => anchor.getAttribute('href')!)
  for (const path of ['/privacy', '/terms']) if (!hrefs.includes(path)) failures.push(`${file}: footer has no link to ${path}`)
  if (!hrefs.some(href => href.startsWith('mailto:'))) failures.push(`${file}: footer has no mailto: contact`)
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
    if (match) fields.set(match[1].toLowerCase(), [...(fields.get(match[1].toLowerCase()) ?? []), match[2].trim()])
  }
  const failures: string[] = []
  if (!fields.get('contact')?.length) failures.push(file + ': no Contact: field')
  const expires = fields.get('expires')?.[0]
  if (!expires || Number.isNaN(Date.parse(expires))) failures.push(file + ': no valid Expires: field')
  else if (Date.parse(expires) <= now.getTime()) failures.push(`${file}: Expires ${expires} is not in the future; renew it`)
  const canonical = `${SITE_ORIGIN}/${file}`
  if (!fields.get('canonical')?.includes(canonical)) failures.push(`${file}: no Canonical: ${canonical}`)
  return failures
}
