import { createHash } from 'node:crypto'
import { checkManifest, rukenToml } from '@mcthaydt/automata-ship'
import { compileHeaders } from '@ruken/manifest'
import { Effect } from 'effect'
import { describe, expect, it } from 'vitest'
import { EXAMPLES_SHIP_CONFIG } from '../examples-ship-config.ts'
import { framePolicy } from './frame-policy.ts'

const IMPORT_MAP = '{"imports":{"zod":"/playground/runtime/zod.js"}}'

function directives(policy: string): Map<string, string> {
  return new Map(
    policy.split(';').map((part) => {
      const [name = '', ...sources] = part.trim().split(/\s+/)
      return [name, sources.join(' ')]
    }),
  )
}

function rukenPolicy(): Map<string, string> {
  const manifest = Effect.runSync(checkManifest(rukenToml(EXAMPLES_SHIP_CONFIG)))
  return directives(compileHeaders(manifest, 'prod')['Content-Security-Policy'] ?? '')
}

describe('framePolicy', () => {
  it("keeps every Ruken directive except manifest-src and frame-ancestors, and script-src's own sources", () => {
    const ruken = rukenPolicy()
    const frame = directives(framePolicy(IMPORT_MAP))
    for (const [name, sources] of ruken) {
      if (name === 'manifest-src' || name === 'frame-ancestors') expect(frame.has(name)).toBe(false)
      else if (name === 'script-src')
        for (const source of sources.split(' ')) expect(frame.get(name)).toContain(source)
      else expect(frame.get(name)).toBe(sources)
    }
  })

  it("adds blob: and the import map's hash to script-src, and never eval or inline scripts", () => {
    const hash = createHash('sha256').update(IMPORT_MAP, 'utf8').digest('base64')
    const scriptSources = directives(framePolicy(IMPORT_MAP)).get('script-src')?.split(' ') ?? []
    expect(scriptSources).toContain('blob:')
    expect(scriptSources).toContain(`'sha256-${hash}'`)
    expect(scriptSources).not.toContain("'unsafe-eval'")
    expect(scriptSources).not.toContain("'unsafe-inline'")
  })

  it('hashes the exact text, so one changed byte changes the policy', () => {
    expect(framePolicy(IMPORT_MAP)).not.toBe(framePolicy(`${IMPORT_MAP} `))
  })
})
