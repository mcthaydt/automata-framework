import { createHash } from 'node:crypto'

/**
 * The pages' Content-Security-Policy (QB.4a; quality-bar spec QB.4): no `unsafe-inline` or `unsafe-eval` for scripts.
 * Each inline script is allowed by the sha256 of its exact text, so the policy is computed from the final HTML, after
 * every rewrite (`finishPage`); SvelteKit's own `kit.csp` hashes its start script before QB.3j's hydration rewrite, and
 * that hash would never match. Styles keep `unsafe-inline`: Svelte writes style attributes, and the spec forbids it for
 * scripts only. A `<meta>` policy cannot carry `frame-ancestors`; the response header does (`securityHeaders`).
 */
export const CSP_META_PREFIX = '<meta http-equiv="Content-Security-Policy" content="'

const INLINE_SCRIPT = /<script(\s[^>]*)?>([\s\S]*?)<\/script>/g
const HEAD = /<head(\s[^>]*)?>/

const OTHER_DIRECTIVES = [
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "frame-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
]

/** The hash source for one inline script's text, as the browser computes it (UTF-8, base64). */
export const scriptHash = (text: string) => `'sha256-${createHash('sha256').update(text, 'utf8').digest('base64')}'`

/** The hash of every inline script in the page, in document order; a script with a `src` runs from a file and has none. */
export function inlineScriptHashes(html: string): string[] {
  return Array.from(html.matchAll(INLINE_SCRIPT))
    .filter(([, attributes]) => !/\ssrc\s*=/.test(attributes ?? ''))
    .map(([, , text]) => scriptHash(text!))
}

/** The page with its policy as the first element of `<head>`, before anything the browser could run or fetch. */
export function withContentSecurityPolicy(html: string): string {
  const scripts = ["script-src 'self'", ...inlineScriptHashes(html)].join(' ')
  const policy = ["default-src 'self'", scripts, ...OTHER_DIRECTIVES].join('; ')
  return html.replace(HEAD, head => `${head}${CSP_META_PREFIX}${policy}">`)
}
