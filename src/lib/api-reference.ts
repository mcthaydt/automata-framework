import type { ApiReference, ApiSearchRow } from '../../scripts/api-reference'

// The reference pages and search read the per-version files `scripts/api-reference.ts` writes. `import.meta.glob` finds every
// version that exists, so adding one needs no code change.
const references = import.meta.glob<ApiReference>('../data/api-reference/*.json', { eager: true, import: 'default' })
const searchLists = import.meta.glob<ApiSearchRow[]>('../data/api-search/*.json', { import: 'default' })

const versionOf = (path: string): string => /([^/]+)\.json$/.exec(path)?.[1] ?? path
const compare = (a: string, b: string): number => b.localeCompare(a, undefined, { numeric: true })

export function apiVersions(): string[] {
  return Object.keys(references).map(versionOf).sort(compare)
}
export const latestApiVersion = (): string => apiVersions()[0]

export function getApiReference(version: string): ApiReference | undefined {
  const path = Object.keys(references).find((p) => versionOf(p) === version)
  return path === undefined ? undefined : references[path]
}

/** The search list loads on demand, so the page that does not search does not carry it. */
export async function loadApiSearch(version: string): Promise<ApiSearchRow[]> {
  const path = Object.keys(searchLists).find((p) => versionOf(p) === version)
  return path === undefined ? [] : searchLists[path]()
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
