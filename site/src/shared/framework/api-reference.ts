import reference from 'virtual:framework/api'
import type { ApiPackage, ApiReference, ApiSearchRow } from './api'

// The reference pages and search read the framework's API index when the site is built (src/shared/framework/api.ts).
// The site documents the workspace's one version; the version stays in the URL so an older one can be added beside it.

/** The packages every game uses; every other package in the reference is an extension a game can add. */
export const CORE_PACKAGES: readonly string[] = [
  '@automata/content',
  '@automata/framework',
  '@automata/sim',
  '@automata/tools',
]

/** A version's packages in two groups: the core a game is built on, and the extensions it can add. */
export function groupPackages(reference: ApiReference): { core: ApiPackage[]; extensions: ApiPackage[] } {
  return {
    core: reference.packages.filter((pkg) => CORE_PACKAGES.includes(pkg.name)),
    extensions: reference.packages.filter((pkg) => !CORE_PACKAGES.includes(pkg.name)),
  }
}

export const API_VERSION: string = reference.version

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
  const rank = (row: ApiSearchRow): number =>
    row.name.toLowerCase().startsWith(words[0]) ? 0 : row.name.toLowerCase().includes(words[0]) ? 1 : 2
  return rows
    .filter((row) => words.every((w) => `${row.name} ${row.summary}`.toLowerCase().includes(w)))
    .sort((a, b) => rank(a) - rank(b) || a.name.length - b.name.length || a.name.localeCompare(b.name))
    .slice(0, limit)
}
