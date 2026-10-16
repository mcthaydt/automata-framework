import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { JSDOM } from 'jsdom'
import { SITE_ORIGIN } from '../src/lib/site.js'

/** The prerendered pages of a build: every HTML file except the demo bundles and the 404 fallback. */
export function builtPages(root: string): string[] {
  return readdirSync(root, { recursive: true }).map(String)
    .filter(p => p.endsWith('.html') && !p.startsWith('demos/') && p !== '404.html')
    .sort()
}

/**
 * Checks a static build and returns one message per failure (an empty list means it passed).
 * Each rule is a regression gate from the quality-bar spec; tests/site-checks.test.ts holds a failing fixture for each.
 */
export function checkSite(root: string): string[] {
  const pages = builtPages(root)
  const failures: string[] = []
  // Store plain ID sets: a long reference page can be linked dozens of times.
  // Rebuilding a JSDOM window for every fragment link retains too much memory.
  const pageIds = new Map<string, Set<string>>()
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
    const window = new JSDOM(readFileSync(join(root, file), 'utf8')).window
    const doc = window.document
    pageIds.set(file, new Set(Array.from(doc.querySelectorAll('[id]'), element => element.id)))
    for (const selector of ['title', 'h1', 'main#main', 'meta[name="description"]', 'meta[property="og:title"]', 'link[rel="canonical"]']) {
      if (doc.querySelectorAll(selector).length !== 1) failures.push(file + ': expected one ' + selector)
    }
    failures.push(...checkIconLinks(file, doc))
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
  failures.push(...checkSeoFiles(root, canonicals), ...checkImageFormats(root), ...checkIconFiles(root))
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
