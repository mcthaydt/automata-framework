import { readFileSync } from 'node:fs'
import { compileHeaders, parseManifest } from '@ruken/manifest'

/** The headers Ruken serves the game with in prod, from the game's own `ruken.toml` (Ruken's CSP has no eval). */
export function rukenHeaders(manifestFile: string): Record<string, string> {
  const parsed = parseManifest(readFileSync(manifestFile, 'utf8'))
  if (!parsed.ok) throw new Error(`ruken.toml: ${parsed.errors.map((error) => error.message).join('; ')}`)
  return compileHeaders(parsed.manifest, 'prod')
}
