// Publish, the page's half: `automata editor` builds the game into one zip on the computer it runs on
// (`/api/publish`), and the page fetches that zip (`/api/publish/file`) and hands it to the person as a download. The
// token goes with both, as the store sends it.

export type PublishResult =
  | { readonly ok: true; readonly name: string }
  | { readonly ok: false; readonly problem: string; readonly detail: string }

/** One place the zip can go, as the server lists it: what to ask the person, and whether it can sign them in. */
export interface PlaceInfo {
  readonly id: string
  readonly name: string
  readonly asks: readonly { readonly id: string; readonly label: string; readonly example: string }[]
  /** A sentence to show before the first put. */
  readonly note?: string
  /** A sentence to show once the game is there. */
  readonly afterNote?: string
  /** Where to make a page on the place, for a person who has none yet. */
  readonly makePage?: { readonly label: string; readonly href: string }
  /** Answers the game already holds, to fill the questions in. */
  readonly known?: Readonly<Record<string, string>>
  readonly signIn: boolean
}

/** The button that signs the person in at a place. It is the editor's own tool, not a game drawing the platform's chrome. */
export const signInLabel = (placeName: string): string => `Sign in to ${placeName}`

/** What came of signing in at a place: `link` is the address the place printed, for a browser that did not open. */
export type SignInResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly problem: string; readonly link?: string }

/** What came of putting the zip somewhere: the game's link, or the one thing the person does next. */
export type PlaceResult =
  | { readonly ok: true; readonly link: string }
  | {
      readonly ok: false
      readonly need: 'butler' | 'account' | 'project' | 'push'
      readonly problem: string
      readonly help?: { readonly label: string; readonly href: string } | undefined
      readonly detail?: string | undefined
    }

/** What the suite's Publish needs: make the zip, save it, and put it in a place. */
export interface GamePublish {
  publish(): Promise<PublishResult>
  /** Saves the zip the last good publish made, under `name`. */
  download(name: string): Promise<void>
  /** Where the zip can be put, in the order to show them. */
  places(): Promise<readonly PlaceInfo[]>
  /** Puts the zip the last good publish made in a place, with the person's answers. */
  putInPlace(id: string, answers: Readonly<Record<string, string>>): Promise<PlaceResult>
  /** Signs the person in at a place, on the computer that runs `automata editor`. */
  signInAtPlace(id: string): Promise<SignInResult>
  /** The editor is open on the computer that runs it; false when a tablet reached it over the network. */
  readonly onThisComputer: boolean
}

export interface PublishClient {
  publish(): Promise<PublishResult>
  /** The zip the last good publish made. */
  zip(): Promise<Blob>
  places(): Promise<readonly PlaceInfo[]>
  putInPlace(id: string, answers: Readonly<Record<string, string>>): Promise<PlaceResult>
  signInAtPlace(id: string): Promise<SignInResult>
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
    async places() {
      const answer = await fetchFn(`${options.base}/api/places`, { headers }).catch(() => undefined)
      return answer?.ok === true ? ((await answer.json()) as PlaceInfo[]) : []
    },
    async putInPlace(id, answers) {
      try {
        const answer = await fetchFn(`${options.base}/api/places/${encodeURIComponent(id)}`, {
          method: 'POST',
          headers: { ...headers, 'content-type': 'application/json' },
          body: JSON.stringify({ answers }),
        })
        const body = (await answer.json()) as Partial<PlaceResult> & { message?: string }
        if (body.ok === true && 'link' in body && typeof body.link === 'string')
          return { ok: true, link: body.link }
        if (body.ok === false && 'need' in body) return body as PlaceResult
        return { ok: false, need: 'push', problem: body.message ?? 'Your game could not be put there.' }
      } catch (error) {
        return {
          ok: false,
          need: 'push',
          problem: STOPPED,
          detail: error instanceof Error ? error.message : String(error),
        }
      }
    },
    async signInAtPlace(id) {
      try {
        const answer = await fetchFn(`${options.base}/api/places/${encodeURIComponent(id)}/sign-in`, {
          method: 'POST',
          headers,
        })
        const body = (await answer.json()) as {
          ok?: boolean
          problem?: string
          message?: string
          link?: string
        }
        if (body.ok === true) return { ok: true }
        return {
          ok: false,
          problem: body.problem ?? body.message ?? 'Signing in did not work.',
          ...(typeof body.link === 'string' ? { link: body.link } : {}),
        }
      } catch {
        return { ok: false, problem: STOPPED }
      }
    },
  }
}

/** The page's own download: a link to the zip's bytes, clicked, then let go. */
export function browserPublish(client: PublishClient, page: Document): GamePublish {
  return {
    publish: () => client.publish(),
    places: () => client.places(),
    putInPlace: (id, answers) => client.putInPlace(id, answers),
    signInAtPlace: (id) => client.signInAtPlace(id),
    // A tablet reached the editor by the computer's address; the person's own computer says localhost.
    onThisComputer: ['localhost', '127.0.0.1', '[::1]', '::1'].includes(page.location.hostname),
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
