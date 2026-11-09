// Publish, the page's half: `automata editor` builds the game into one zip on the computer it runs on
// (`/api/publish`), and the page fetches that zip (`/api/publish/file`) and hands it to the person as a download. The
// token goes with both, as the store sends it.

export type PublishResult =
  | { readonly ok: true; readonly name: string }
  | { readonly ok: false; readonly problem: string; readonly detail: string }

/** What the suite's Publish needs: build the game, then save the zip it made. */
export interface GamePublish {
  publish(): Promise<PublishResult>
  /** Saves the zip the last good publish made, under `name`. */
  download(name: string): Promise<void>
}

export interface PublishClient {
  publish(): Promise<PublishResult>
  /** The zip the last good publish made. */
  zip(): Promise<Blob>
}

export interface PublishClientOptions {
  /** The editor server's origin. */
  readonly base: string
  readonly token?: string | undefined
  readonly fetch?: typeof fetch | undefined
}

const STOPPED = 'The editor’s command has stopped. Start automata editor again, then try again.'

export function createPublishClient(options: PublishClientOptions): PublishClient {
  const fetchFn = options.fetch ?? ((...args: Parameters<typeof fetch>) => fetch(...args))
  const headers: Record<string, string> =
    options.token === undefined ? {} : { authorization: `Bearer ${options.token}` }
  return {
    async publish() {
      try {
        const answer = await fetchFn(`${options.base}/api/publish`, { method: 'POST', headers })
        const body = (await answer.json()) as Partial<{
          ok: boolean
          name: string
          problem: string
          detail: string
          message: string
        }>
        if (body.ok === true && typeof body.name === 'string') return { ok: true, name: body.name }
        return {
          ok: false,
          problem: body.problem ?? body.message ?? 'Your game could not be published.',
          detail: body.detail ?? '',
        }
      } catch (error) {
        return { ok: false, problem: STOPPED, detail: error instanceof Error ? error.message : String(error) }
      }
    },
    async zip() {
      const answer = await fetchFn(`${options.base}/api/publish/file`, { headers })
      if (!answer.ok) throw new Error(STOPPED)
      return answer.blob()
    },
  }
}

/** The page's own download: a link to the zip's bytes, clicked, then let go. */
export function browserPublish(client: PublishClient, page: Document): GamePublish {
  return {
    publish: () => client.publish(),
    async download(name) {
      const url = URL.createObjectURL(await client.zip())
      const link = page.createElement('a')
      link.href = url
      link.download = name
      page.body.append(link)
      link.click()
      link.remove()
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
    },
  }
}
