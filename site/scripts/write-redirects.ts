import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { REDIRECTS, redirectFile, redirectPage } from '../src/features/redirects/redirects.ts'

/** Writes one redirect page per cut address into a static build (`src/features/redirects/redirects.ts` says why). */
export function writeRedirects(root: string): void {
  for (const [from, to] of Object.entries(REDIRECTS)) {
    const file = join(root, redirectFile(from))
    // `/docs/overview` lives in `docs/`, which a build always has but a test's empty folder does not.
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, redirectPage(to))
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const root = resolve(process.argv[2] ?? 'build')
  writeRedirects(root)
  console.log(`Wrote ${Object.keys(REDIRECTS).length} redirect pages.`)
}
