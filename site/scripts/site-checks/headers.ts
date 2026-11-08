// The host's `_headers` file, and what the host would send under it. Cloudflare Pages applies the headers of every rule
// whose pattern matches a path, and a header named by two rules arrives twice (joined with a comma), which is malformed
// for Strict-Transport-Security and two policies for Content-Security-Policy. So the file is written from the headers the
// site means to send (src/shared/html/security-headers.ts and the playground's headers.ts), and this module checks the
// two agree for every file of a build, as the host's own rule would read them.
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { playgroundHeaders } from '../../src/features/playground/headers.ts'
import { securityHeaders } from '../../src/shared/html/security-headers.ts'

export interface HeaderRule {
  readonly pattern: string
  /** Headers set by a broader rule that this one takes away before it sets its own (`! Name`). */
  readonly detach?: readonly string[]
  readonly headers: Readonly<Record<string, string>>
}

/** The `_headers` text: a pattern line, then its indented detach lines and headers, a blank line between rules. */
export function headersFile(rules: readonly HeaderRule[]): string {
  return rules
    .map((rule) =>
      [
        rule.pattern,
        ...(rule.detach ?? []).map((name) => `  ! ${name}`),
        ...Object.entries(rule.headers).map(([name, value]) => `  ${name}: ${value}`),
      ].join('\n'),
    )
    .join('\n\n')
    .concat(rules.length ? '\n' : '')
}

/** A pattern as the host reads it: `*` takes any run of characters, including slashes and none. */
function patternMatches(pattern: string, path: string): boolean {
  const source = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')
  return new RegExp(`^${source}$`).test(path)
}

/** What the host sends for `path` under `file`: every matching rule's values, in order, less what a rule detaches. */
export function matchHeaders(file: string, path: string): Record<string, string[]> {
  const sent: Record<string, string[]> = {}
  let matching = false
  for (const line of file.split('\n')) {
    if (line.trim() === '') continue
    if (!line.startsWith(' ')) {
      matching = patternMatches(line.trim(), path)
      continue
    }
    if (!matching) continue
    const text = line.trim()
    if (text.startsWith('! ')) {
      delete sent[text.slice(2).trim()]
      continue
    }
    const colon = text.indexOf(':')
    const name = text.slice(0, colon)
    sent[name] = [...(sent[name] ?? []), text.slice(colon + 1).trim()]
  }
  return sent
}

/** The address a built file is served at: `index.html` is the folder's address, `x.html` is `/x`. */
export function addressOf(file: string): string {
  if (file === 'index.html') return '/'
  if (file.endsWith('/index.html')) return `/${file.slice(0, -'index.html'.length)}`
  return `/${file.replace(/\.html$/, '')}`
}

const files = (root: string): string[] =>
  readdirSync(root, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name).slice(root.length + 1))
    .filter((file) => file !== '_headers')

/**
 * One message per path and header whose sent value differs from what the site means to send. The addresses checked are
 * every file's, plus `/no-such-page`, which the host answers with 404.html and the site's headers like any other.
 */
export function headerProblems(root: string): string[] {
  const path = join(root, '_headers')
  if (!existsSync(path)) return ['_headers: the build wrote no _headers file']
  const file = readFileSync(path, 'utf8')
  const problems: string[] = []
  for (const address of new Set([...files(root).map(addressOf), '/no-such-page'])) {
    const sent = matchHeaders(file, address)
    const meant = { ...securityHeaders(address), ...playgroundHeaders(address) }
    for (const [name, value] of Object.entries(meant)) {
      const got = sent[name]
      if (got === undefined)
        problems.push(`${address}: ${name} should be ${value} but the host sends nothing`)
      else if (got.length > 1) problems.push(`${address}: ${name} arrives twice (${got.join(' | ')})`)
      else if (got[0] !== value)
        problems.push(`${address}: ${name} should be ${value} but the host sends ${got[0]}`)
    }
    for (const name of Object.keys(sent))
      if (!(name in meant))
        problems.push(`${address}: the host sends ${name}, which the site does not mean to`)
  }
  return problems
}
