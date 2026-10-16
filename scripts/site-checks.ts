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
  failures.push(...checkSeoFiles(root, canonicals))
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
