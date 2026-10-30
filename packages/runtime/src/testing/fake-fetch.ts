/**
 * How `fakeFetch` answers one url: a status, the body in chunks, a content length or type, a hang or a
 * network error.
 */
export interface FakeRoute {
  readonly status?: number
  readonly chunks?: readonly Uint8Array[]
  readonly contentLength?: number
  readonly hang?: boolean
  readonly networkError?: boolean
  readonly type?: string
}

/** Options for `fakeFetch`: the fetch that answers urls with no route. */
export interface FakeFetchOptions {
  readonly fallback?: typeof fetch
}

/** The fake fetch, and the urls it was asked for and saw aborted. */
export interface FakeFetchResult {
  readonly fetch: typeof fetch
  readonly requests: string[]
  readonly aborted: string[]
}

/**
 * Creates an in-memory fetch implementation for deterministic loading tests.
 */
export function fakeFetch(
  routes: Readonly<Record<string, FakeRoute>>,
  options: FakeFetchOptions = {},
): FakeFetchResult {
  const requests: string[] = []
  const aborted: string[] = []

  const mockFetch: typeof fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
    requests.push(url)

    const route = routes[url]
    if (!route) {
      if (options.fallback) {
        return options.fallback(input, init)
      }
      return new Response('Not found', { status: 404 })
    }

    if (route.networkError) {
      throw new TypeError(`Network error fetching ${url}`)
    }

    const signal = init?.signal
    if (signal?.aborted) {
      aborted.push(url)
      throw new DOMException('The user aborted a request.', 'AbortError')
    }

    const chunks = route.chunks ?? []
    const status = route.status ?? 200
    const contentType = route.type ?? 'application/octet-stream'

    const totalBytes =
      route.contentLength ?? (route.chunks ? route.chunks.reduce((acc, c) => acc + c.length, 0) : undefined)

    const headers: Record<string, string> = {
      'content-type': contentType,
    }
    if (totalBytes !== undefined) {
      headers['content-length'] = String(totalBytes)
    }

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        if (signal) {
          signal.addEventListener('abort', () => {
            aborted.push(url)
            controller.error(new DOMException('The user aborted a request.', 'AbortError'))
          })
        }

        for (const chunk of chunks) {
          if (signal?.aborted) return
          controller.enqueue(chunk)
        }

        if (!route.hang) {
          controller.close()
        }
      },
    })

    return new Response(stream, {
      status,
      headers,
    })
  }

  return {
    fetch: mockFetch,
    requests,
    aborted,
  }
}
