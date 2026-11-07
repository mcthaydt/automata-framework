/// <reference path="./jsdom.d.ts" />
// The built site's checks (`pnpm check:site`): checkSite walks every page and runs each rule. The rules live by
// subject in site-checks/: the words (copy.ts), what a page loads (assets.ts) and its JavaScript (javascript.ts).
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { JSDOM } from 'jsdom'
import { REPOSITORY_PUBLIC, REPOSITORY_URL, SITE_ORIGIN } from '../src/shared/site.js'
import {
  checkIconFiles,
  checkIconLinks,
  checkImageFormats,
  checkPageResources,
  readFontFaces,
} from './site-checks/assets.ts'
import { BANNED_PHRASES, checkStandalone, ownText, SITE_TEXT_FILES } from './site-checks/copy.ts'
import {
  checkContentSecurityPolicy,
  checkHydrationStart,
  checkPreloadedScripts,
} from './site-checks/javascript.ts'
import { builtPages } from './site-checks/pages.ts'

/**
 * Checks a static build and returns one message per failure (an empty list means it passed).
 * Each rule is a regression gate from the quality-bar spec; tests/unit/scripts/site-checks.test.ts holds a failing fixture for each.
 */
export function checkSite(
  root: string,
  { now = new Date(), repositoryPublic = REPOSITORY_PUBLIC }: { now?: Date; repositoryPublic?: boolean } = {},
): string[] {
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
      if (!repositoryPublic && href.startsWith(REPOSITORY_URL))
        failures.push(`${file}: links to the private repository (${href})`)
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
