import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { JSDOM } from 'jsdom'
import { SITE_ORIGIN } from '../src/lib/site.js'

const root = resolve('build')
const pages = readdirSync(root, { recursive: true }).map(String).filter(p => p.endsWith('.html') && !p.startsWith('demos/') && p !== '404.html')
const failures: string[] = []
// Store plain ID sets: a long reference page can be linked dozens of times.
// Rebuilding a JSDOM window for every fragment link retains too much memory.
const pageIds = new Map<string, Set<string>>()
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
  if (!doc.querySelector('link[rel="canonical"]')?.getAttribute('href')?.startsWith(SITE_ORIGIN + '/')) failures.push(file + ': wrong canonical origin')
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
if (failures.length) throw new Error(failures.join('\n'))
console.log(`Verified ${pages.length} built pages: titles, metadata, main landmarks, links and anchors.`)
