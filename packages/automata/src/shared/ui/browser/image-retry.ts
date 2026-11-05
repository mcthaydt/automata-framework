/**
 * Art the DOM draws by URL, and how a dropped request for it is retried.
 *
 * A phone on Wi-Fi drops the odd request. A dropped request is not a lost
 * image: each retry waits longer than the last, and asks for a URL of its
 * own, so no cache hands back the failure. `watchImage` does it for art drawn
 * as a CSS background, which reports neither a load nor an error; an `img`
 * can retry itself on the same terms with `retryUrl` and `RETRY_DELAYS_MS`.
 */

/** The wait before each retry; when they are spent, the image has failed. */
export const RETRY_DELAYS_MS: readonly number[] = [250, 750, 2000]

/** The URL a retry asks for; attempt 0 is the first request, as given. */
export function retryUrl(src: string, attempt: number): string {
  return attempt === 0 ? src : `${src}${src.includes('?') ? '&' : '?'}retry=${attempt}`
}

/** The timers `watchImage` waits with; tests pass fakes. */
export type RetryTimers = {
  setTimeout(run: () => void, ms: number): ReturnType<typeof setTimeout>
  clearTimeout(handle: ReturnType<typeof setTimeout> | undefined): void
}

const realTimers: RetryTimers = {
  setTimeout: (run, ms) => setTimeout(run, ms),
  clearTimeout: (handle) => clearTimeout(handle),
}

/**
 * Probes `src` and, while it fails, hands `onRetry` each retry's URL to draw
 * instead. Returns the stop.
 */
export function watchImage(
  src: string,
  onRetry: (url: string) => void,
  timers: RetryTimers = realTimers,
): () => void {
  let stopped = false
  let timer: ReturnType<typeof setTimeout> | undefined
  let probe: HTMLImageElement | undefined

  const request = (attempt: number): void => {
    const image = new Image()
    probe = image
    image.onerror = () => {
      const delay = RETRY_DELAYS_MS[attempt]
      if (stopped || delay === undefined) return
      timer = timers.setTimeout(() => {
        if (stopped) return
        onRetry(retryUrl(src, attempt + 1))
        request(attempt + 1)
      }, delay)
    }
    image.src = retryUrl(src, attempt)
  }
  request(0)

  return () => {
    stopped = true
    timers.clearTimeout(timer)
    if (probe !== undefined) probe.onerror = null
  }
}
