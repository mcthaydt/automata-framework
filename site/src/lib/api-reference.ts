import reference from 'virtual:framework/api'
import type { ApiReference, ApiSearchRow } from '../shared/framework/api'

// The reference pages and search read the framework's API index when the site is built (src/shared/framework/api.ts).
// The site documents the workspace's one version; the version stays in the URL so an older one can be added beside it.

export function apiVersions(): string[] {
  return [reference.version]
}
export const latestApiVersion = (): string => reference.version

export function getApiReference(version: string): ApiReference | undefined {
  return version === reference.version ? reference : undefined
}

/** The search list loads on demand, so the page that does not search does not carry it. */
export async function loadApiSearch(version: string): Promise<ApiSearchRow[]> {
  return version === reference.version ? (await import('virtual:framework/api-search')).default : []
}

/** Every word must appear in the name or the summary. Names that start with the query come first, then shorter names. */
export function searchApi(rows: readonly ApiSearchRow[], query: string, limit = 50): ApiSearchRow[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (words.length === 0) return []
  const rank = (row: ApiSearchRow): number => (row.name.toLowerCase().startsWith(words[0]) ? 0 : row.name.toLowerCase().includes(words[0]) ? 1 : 2)
  return rows
    .filter((row) => words.every((w) => `${row.name} ${row.summary}`.toLowerCase().includes(w)))
    .sort((a, b) => rank(a) - rank(b) || a.name.length - b.name.length || a.name.localeCompare(b.name))
    .slice(0, limit)
}
