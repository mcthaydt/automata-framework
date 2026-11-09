// Writes `build/_headers`, the file Cloudflare Pages reads, from the headers the site already sends in its own server
// (security-headers.ts and the playground's headers.ts), so the live site and the browser suite cannot differ. The host
// applies every matching rule, so each narrower rule detaches the broader header it replaces instead of repeating it.
import { writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { playgroundHeaders } from '../src/features/playground/headers.ts'
import { securityHeaders } from '../src/shared/html/security-headers.ts'
import { type HeaderRule, headersFile } from './site-checks/headers.ts'

/** A rule for `pattern` that sets what `path` gets beyond the base, detaching the base headers it changes. */
function narrower(pattern: string, path: string, base: Record<string, string>): HeaderRule {
  const own = securityHeaders(path)
  const changed = Object.entries(own).filter(([name, value]) => base[name] !== value)
  return {
    pattern,
    detach: changed.map(([name]) => name),
    headers: Object.fromEntries(changed),
  }
}

export function headerRules(): HeaderRule[] {
  const base = securityHeaders('/')
  return [
    { pattern: '/*', headers: base },
    // The framework's own builds carry their whole policy; the example previews delegate full screen and the gamepad.
    narrower('/demos/*', '/demos/x', base),
    narrower('/editor/app/*', '/editor/app/', base),
    narrower('/examples/*', '/examples/x', base),
    narrower('/playground/examples/*', '/playground/examples/x', base),
    { pattern: '/playground/*', headers: playgroundHeaders('/playground/x') },
    {
      pattern: '/playground/runtime/*',
      detach: ['Cache-Control'],
      headers: { 'Cache-Control': playgroundHeaders('/playground/runtime/x')['Cache-Control'] },
    },
  ]
}

/** Writes the file into `root` and returns its text. */
export function writeHeaders(root: string): string {
  const text = headersFile(headerRules())
  writeFileSync(join(root, '_headers'), text)
  return text
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const root = resolve(process.argv[2] ?? 'build')
  writeHeaders(root)
  console.log('Wrote _headers.')
}
