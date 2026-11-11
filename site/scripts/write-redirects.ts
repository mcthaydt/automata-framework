// Writes `build/_redirects`, the file Cloudflare Pages reads, from the rules in src/shared/redirects.ts. It sits beside
// `_headers` (write-headers.ts) and the live check (check-deployed.ts) reads the same list, so what the build says and
// what the host answers cannot differ.
import { writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { REDIRECTS, type Redirect } from '../src/shared/redirects.ts'

/** The file's text: one `from to status` line per rule. A rule the host would read differently is refused. */
export function redirectsFile(rules: readonly Redirect[]): string {
  return rules
    .map(({ from, to, status }) => {
      if (![301, 302, 307, 308].includes(status))
        throw new Error(`${from}: ${status} is not a redirect status`)
      if (/\s/.test(from) || /\s/.test(to))
        throw new Error(`${from} → ${to}: a space in an address splits the line`)
      return `${from} ${to} ${status}\n`
    })
    .join('')
}

/** Writes the file into `root` and returns its text. */
export function writeRedirects(root: string): string {
  const text = redirectsFile(REDIRECTS)
  writeFileSync(join(root, '_redirects'), text)
  return text
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  writeRedirects(resolve(process.argv[2] ?? 'build'))
  console.log('Wrote _redirects.')
}
