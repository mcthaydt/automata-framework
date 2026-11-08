// Which files of a build are the site's pages, and the address each one is served at.
import { readdirSync } from 'node:fs'
import { REDIRECTS, redirectFile } from '../../src/features/redirects/redirects.ts'
import { SITE_ORIGIN } from '../../src/shared/site.js'

/** Folders the site copies in from the framework as built: the demo bundles and the playground (frame pages, runtime). */
const FRAMEWORK_TREES = ['demos/', 'playground/', 'editor/app/']
export const fromFramework = (path: string) => FRAMEWORK_TREES.some((tree) => path.startsWith(tree))
// The cut pages' redirects are not pages: no header, no canonical, and never in the sitemap.
const REDIRECT_FILES = new Set(Object.keys(REDIRECTS).map(redirectFile))

/** The prerendered pages of a build: every HTML file except the framework's trees, the redirects and the 404 fallback. */
export function builtPages(root: string): string[] {
  return readdirSync(root, { recursive: true })
    .map(String)
    .filter((p) => p.endsWith('.html') && !fromFramework(p) && !REDIRECT_FILES.has(p) && p !== '404.html')
    .sort()
}

/** The URL a built page is served at: `index.html` is `/`, `docs/editor.html` is `/docs/editor`. */
export function pageUrl(file: string): URL {
  const path =
    file === 'index.html'
      ? ''
      : file.endsWith('/index.html')
        ? file.slice(0, -'index.html'.length)
        : file.replace(/\.html$/, '')
  return new URL('/' + path, SITE_ORIGIN)
}

/** A reference that leads to another origin; a relative or same-origin one does not. */
export function isOtherOrigin(reference: string): boolean {
  return /^(https?:)?\/\//i.test(reference) && new URL(reference, SITE_ORIGIN).origin !== SITE_ORIGIN
}
