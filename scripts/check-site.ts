import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { JSDOM } from 'jsdom'
import { SITE_ORIGIN } from '../src/lib/site.js'

const root = resolve('build')
const pages = readdirSync(root, { recursive: true }).map(String).filter(p => p.endsWith('.html') && !p.startsWith('demos/') && p !== '404.html')
const failures: string[] = []
for (const file of pages) {
  const doc = new JSDOM(readFileSync(join(root, file), 'utf8')).window.document
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
      const destination = new JSDOM(readFileSync(join(root, target), 'utf8')).window.document
      if (!destination.getElementById(url.hash.slice(1))) failures.push(file + ': missing destination anchor ' + href)
    }
  }
}
if (failures.length) throw new Error(failures.join('\n'))
console.log(`Verified ${pages.length} built pages: titles, metadata, main landmarks, links and anchors.`)
