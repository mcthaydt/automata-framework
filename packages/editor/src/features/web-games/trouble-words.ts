import { OfflineError } from '../../shared/kit/sync/git-engine'

// A failed request reaches a person as the browser's own words ("Failed to fetch", "Load failed"). Those say nothing
// to a grandma: say what happened and what to press.

const NO_CONNECTION =
  /^(?:Failed to fetch|Load failed|fetch failed|NetworkError when attempting to fetch resource\.?)$/i

/** What went wrong in words that say what to do. `then` says what to do once the internet is back (“press Get it again”). */
export function troubleWords(error: unknown, then: string): string {
  const message = error instanceof Error ? error.message : String(error)
  if (error instanceof OfflineError || NO_CONNECTION.test(message))
    return `Can’t reach GitHub. Check your internet and ${then}.`
  return message
}
