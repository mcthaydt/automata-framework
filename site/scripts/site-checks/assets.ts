// What a built page loads besides its code: images in the format their names say, the icon set, fonts from the
// site itself, and nothing from another origin.
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { SITE_ORIGIN } from '../../src/shared/site.js'
import { fromFramework, isOtherOrigin, pageUrl } from './pages.ts'

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
export function checkImageFormats(root: string): string[] {
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
export function checkIconLinks(file: string, doc: Document): string[] {
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
export function checkIconFiles(root: string): string[] {
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

/** No page loads a resource from another origin, and each preloads a self-hosted font face (spec F-5). */
export function checkPageResources(file: string, doc: Document, fontUrls: Set<string>): string[] {
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
 * Reads the site's built stylesheets (not the demo bundles or the playground, which are framework builds with their own fonts):
 * every @font-face must use font-display: swap, and no stylesheet may load from another origin.
 * Returns the site paths of the woff2 files the font faces use, for the preload check.
 */
export function readFontFaces(root: string): { urls: Set<string>; failures: string[] } {
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
