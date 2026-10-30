import { resolve } from 'node:path'
import { builtPages, checkSite } from './site-checks.ts'

const root = resolve('build')
const failures = checkSite(root)
if (failures.length) throw new Error(failures.join('\n'))
console.log(`Verified ${builtPages(root).length} built pages: titles, metadata, landmarks, links, anchors, sitemap, robots.txt, icons, image formats, alt text, fonts, third-party assets, preloaded script weight, hydration after the first paint, the Content-Security-Policy, footer contact, security.txt and banned phrases.`)
