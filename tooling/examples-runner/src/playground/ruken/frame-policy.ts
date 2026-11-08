import { createHash } from 'node:crypto'
import { checkManifest, rukenToml } from '@mcthaydt/automata-tools/internal'
import { compileHeaders } from '@ruken/manifest'
import { Effect } from 'effect'
import { EXAMPLES_SHIP_CONFIG } from '../../examples-ship-config.ts'

// The policy of a playground frame page. It starts from Ruken's own CSP for the
// examples' manifest, read from `compileHeaders`, so a Ruken change reaches the playground without a copy here, and changes only what a frame page
// needs: `script-src` gains `blob:` (the reader's compiled example is a Blob module) and the hash of the page's one
// inline script, its import map. `manifest-src` has no use in a frame page, and `frame-ancestors` is ignored in a
// meta policy, so both go.
const DROPPED = new Set(['manifest-src', 'frame-ancestors'])

function rukenPolicy(): string {
  const manifest = Effect.runSync(checkManifest(rukenToml(EXAMPLES_SHIP_CONFIG)))
  const policy = compileHeaders(manifest, 'prod')['Content-Security-Policy']
  if (policy === undefined) throw new Error('compileHeaders returned no Content-Security-Policy')
  return policy
}

// WebKit does not match 'self' to the site for a fetch from an opaque-origin document, though it does for scripts and
// images (measured by the feasibility test), so `connect-src` names the site's origin beside 'self'.
function checkedOrigin(siteOrigin: string): string {
  let parsed: string | undefined
  try {
    parsed = new URL(siteOrigin).origin
  } catch {
    parsed = undefined
  }
  if (parsed !== siteOrigin) throw new Error(`framePolicy: ${JSON.stringify(siteOrigin)} is not an origin`)
  return siteOrigin
}

/**
 * The frame page's Content-Security-Policy, for a page whose import map is exactly `importMapText`, served from
 * `siteOrigin` (scheme, host and port only).
 */
export function framePolicy(importMapText: string, siteOrigin: string): string {
  const origin = checkedOrigin(siteOrigin)
  const hash = createHash('sha256').update(importMapText, 'utf8').digest('base64')
  return rukenPolicy()
    .split(';')
    .map((directive) => directive.trim())
    .filter((directive) => !DROPPED.has(directive.split(/\s+/)[0] ?? ''))
    .map((directive) => {
      if (directive.startsWith('script-src ')) return `${directive} blob: 'sha256-${hash}'`
      if (directive.startsWith('connect-src ')) return `${directive} ${origin}`
      return directive
    })
    .join('; ')
}
