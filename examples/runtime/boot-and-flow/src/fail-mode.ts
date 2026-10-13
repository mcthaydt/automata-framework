export type FailMode = 'init' | 'saves' | 'content' | 'download' | 'stall' | 'renderer' | 'ready'

export const FAIL_MODES: readonly FailMode[] = [
  'init',
  'saves',
  'content',
  'download',
  'stall',
  'renderer',
  'ready',
]

/**
 * Extracts and validates the `?fail=` query mode (spec §8).
 * Supports search strings (e.g. `?fail=stall`) or full URLs.
 */
export function failMode(
  queryOrUrl: string = typeof window !== 'undefined' ? window.location.search : '',
): FailMode | undefined {
  if (!queryOrUrl) return undefined

  let search = queryOrUrl
  try {
    if (queryOrUrl.startsWith('http://') || queryOrUrl.startsWith('https://')) {
      search = new URL(queryOrUrl).search
    }
  } catch {
    // fallback to parsing queryOrUrl directly
  }

  const params = new URLSearchParams(search.startsWith('?') ? search : `?${search}`)
  const value = params.get('fail')
  if (value && (FAIL_MODES as readonly string[]).includes(value)) {
    return value as FailMode
  }
  return undefined
}
