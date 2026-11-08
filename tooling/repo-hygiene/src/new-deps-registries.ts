import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

/** `@scope:registry=url` lines of the root .npmrc; none when the repository has no .npmrc (every scope is on npmjs.org). */
export function scopeRegistries(root: string): Record<string, string> {
  const scopes: Record<string, string> = {}
  const file = join(root, '.npmrc')
  if (!existsSync(file)) return scopes
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const match = /^(@[^:]+):registry=(\S+)$/.exec(line.trim())
    if (match?.[1] !== undefined && match[2] !== undefined) scopes[match[1]] = match[2].replace(/\/$/, '')
  }
  return scopes
}
