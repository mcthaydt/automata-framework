import { readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { SITE_ORIGIN } from '../src/lib/site.js'
import { builtPages } from './site-checks.ts'

/**
 * Writes sitemap.xml and robots.txt into a static build (spec F-3). The sitemap lists the canonical URL of every
 * prerendered page, read from the page itself, so it cannot drift from what the build actually contains.
 */
export function writeSeoFiles(root: string): void {
  const urls = builtPages(root)
    .map((file) => {
      const canonical = /<link rel="canonical" href="([^"]+)"/.exec(
        readFileSync(join(root, file), 'utf8'),
      )?.[1]
      if (!canonical) throw new Error(file + ': no canonical link to list in sitemap.xml')
      return canonical
    })
    .sort()
  const entries = urls.map((url) => `  <url><loc>${url}</loc></url>`).join('\n')
  writeFileSync(
    join(root, 'sitemap.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</urlset>\n`,
  )
  writeFileSync(join(root, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${SITE_ORIGIN}/sitemap.xml\n`)
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const root = resolve(process.argv[2] ?? 'build')
  writeSeoFiles(root)
  console.log('Wrote sitemap.xml and robots.txt for ' + builtPages(root).length + ' pages.')
}
