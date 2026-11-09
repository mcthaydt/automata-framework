// The missing-address page is an ordinary prerendered route (`/not-found`), so it is a real page with its own head and
// first paint. A static host serves `404.html` for an address nothing answers, so the build moves it there. adapter-static
// writes routes as `<route>.html`, not `<route>/index.html`, which is why this renames one file and its two compressed
// copies. Run after `vite build` and before the sitemap is written, so the sitemap never lists it.
import { existsSync, renameSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

export function moveNotFoundPage(root: string): void {
  if (!existsSync(join(root, 'not-found.html'))) throw new Error(`${root}: the build wrote no not-found.html`)
  for (const suffix of ['', '.br', '.gz']) {
    const from = join(root, `not-found.html${suffix}`)
    if (existsSync(from)) renameSync(from, join(root, `404.html${suffix}`))
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  moveNotFoundPage(resolve(process.argv[2] ?? 'build'))
  console.log('Moved not-found.html to 404.html.')
}
