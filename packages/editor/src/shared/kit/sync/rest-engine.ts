// Keeps a game in step with a GitHub repository through GitHub's REST API (which a web page may call), so the web editors
// run the same sync loop as the apps: `startSync` decides when, this decides how. What the two sides last agreed on is in
// `.automata/sync.json` beside the game (never pushed, never pulled): the commit and tree, the id git gives every file at
// that point, and a commit message waiting to go. A file's id is the SHA-1 git computes, so what changed on either side is
// known without downloading anything; a file changed on both sides goes through `mergeFile`, and what cannot merge is left
// as the person had it.
import type { ProjectStore } from '../storage/project-store'
import { blobId } from './blob-id'
import { generatedFolders, isGeneratedPath } from './generated-files'
import {
  type GitEngine,
  type MergeAsk,
  OfflineError,
  type PullOutcome,
  type PushResult,
  type Resolved,
  SyncStopped,
} from './git-engine'
import { keepBothName, mergeFile } from './merge-drivers'

const API = 'https://api.github.com'
const NOTES = '.automata/'
const SYNC_FILE = '.automata/sync.json'
const EDITOR_LIST = 'content/editors.toml'
const TOO_BIG = 'This game is too big to sync on the web. Use the Automata app.'
const WAIT = 'GitHub asked us to wait. Your game is saved on this device.'
const SIGN_IN_AGAIN = 'Sign in to GitHub again to keep your game there.'

/** A file that changed on both sides, with GitHub's id for it at the head it was asked about (`null`: deleted there). */
export interface AskedFile extends MergeAsk {
  readonly theirs: string | null
}

/** What both sides last agreed on, kept at `.automata/sync.json`. */
export interface SyncFile {
  readonly repo: string
  /** The repository's `default_branch`, read once. */
  readonly branch: string
  readonly base?: { readonly commit: string; readonly tree: string } | undefined
  /** The id git gives each file at `base`. */
  readonly files: Readonly<Record<string, string>>
  readonly etag?: string | undefined
  /** A commit message for the changes here that GitHub does not have yet. */
  readonly pending?: { readonly message: string; readonly at: number } | undefined
  /** Files that changed on both sides and wait for the person; they are left out of every push. */
  readonly asked?: readonly AskedFile[] | undefined
}

export interface RestEngineOptions {
  readonly fetch: typeof fetch
  /** A working access token, or nothing when the person is not signed in. */
  token(): Promise<string | undefined>
  readonly store: ProjectStore
  /** `owner/name`. */
  readonly repo: string
  now?: () => number
}

const decoder = new TextDecoder()

function toBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i += 0x8000)
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(binary)
}

const fromBase64 = (text: string): Uint8Array =>
  Uint8Array.from(atob(text.replace(/\s/g, '')), (c) => c.charCodeAt(0))

interface Local {
  readonly sha: string
  readonly bytes: Uint8Array
}

export function createRestEngine(options: RestEngineOptions): GitEngine {
  const { store, repo } = options
  const now = options.now ?? Date.now
  /** The head fetched and not yet brought in. */
  let fetched: { readonly commit: string; readonly etag: string | undefined } | undefined

  async function readSync(): Promise<SyncFile> {
    const bytes = await store.read(SYNC_FILE)
    if (bytes !== undefined)
      try {
        return JSON.parse(decoder.decode(bytes)) as SyncFile
      } catch {
        // A damaged note is treated as no note: the next pull merges from nothing and asks about what differs.
      }
    return { repo, branch: '', files: {} }
  }
  async function writeSync(file: SyncFile): Promise<void> {
    const written = await store.write(SYNC_FILE, `${JSON.stringify(file, null, 2)}\n`)
    if (!written.ok) throw new Error(written.message)
  }

  /** One call to GitHub. A network that is gone or a server that does not answer is `OfflineError`; the rest is for the caller. */
  async function api(path: string, init: RequestInit = {}, root = `/repos/${repo}`): Promise<Response> {
    const token = await options.token()
    if (token === undefined) throw new OfflineError('Not signed in to GitHub.')
    let response: Response
    try {
      response = await options.fetch(`${API}${root}${path}`, {
        ...init,
        headers: {
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          ...(init.body === undefined ? {} : { 'Content-Type': 'application/json' }),
          ...(init.headers as Record<string, string> | undefined),
          Authorization: `Bearer ${token}`,
        },
      })
    } catch {
      throw new OfflineError()
    }
    const wait = Number(response.headers.get('retry-after'))
    if ((response.status === 403 || response.status === 429) && wait > 0)
      throw new SyncStopped(WAIT, now() + wait * 1000)
    if (response.status === 401) throw new SyncStopped(SIGN_IN_AGAIN)
    if (response.status >= 500) throw new OfflineError('GitHub did not answer.')
    return response
  }

  async function json<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await api(path, init)
    if (!response.ok) throw new OfflineError(`GitHub said ${String(response.status)}.`)
    return (await response.json()) as T
  }

  async function branchOf(file: SyncFile): Promise<SyncFile> {
    if (file.branch !== '') return file
    const { default_branch } = await json<{ default_branch: string }>('')
    const next = { ...file, repo, branch: default_branch }
    await writeSync(next)
    return next
  }

  async function localFiles(): Promise<Map<string, Local>> {
    const found = new Map<string, Local>()
    for (const entry of await store.list()) {
      if (entry.path.startsWith(NOTES)) continue
      const bytes = await store.read(entry.path)
      if (bytes !== undefined) found.set(entry.path, { sha: await blobId(bytes), bytes })
    }
    return found
  }

  async function blobBytes(sha: string): Promise<Uint8Array> {
    return fromBase64((await json<{ content: string }>(`/git/blobs/${sha}`)).content)
  }

  /** `art/hero-github.png`, or `art/hero-github-2.png` when that is taken: a name nothing here has. */
  async function freeName(path: string): Promise<string> {
    const dot = path.lastIndexOf('.')
    const split = dot > path.lastIndexOf('/') + 1 ? dot : path.length
    for (let n = 1; ; n++) {
      const candidate = n === 1 ? path : `${path.slice(0, split)}-${String(n)}${path.slice(split)}`
      if ((await store.read(candidate)) === undefined) return candidate
    }
  }

  /** The files changed here since the last agreement: path to its id now, or `null` for one that is gone. */
  function changesHere(file: SyncFile, local: Map<string, Local>): Map<string, string | null> {
    const asked = new Set((file.asked ?? []).map((ask) => ask.path))
    const changes = new Map<string, string | null>()
    for (const [path, { sha }] of local)
      if (!asked.has(path) && file.files[path] !== sha) changes.set(path, sha)
    for (const path of Object.keys(file.files))
      if (!asked.has(path) && !local.has(path)) changes.set(path, null)
    return changes
  }

  return {
    async fetchMain() {
      const file = await branchOf(await readSync())
      const response = await api(`/git/ref/heads/${file.branch}`, {
        headers: file.etag === undefined ? {} : { 'If-None-Match': file.etag },
      })
      if (response.status === 304) return 'unchanged'
      // A repository just made on github.com/new has no commits and refuses the Git Data API; there is nothing to bring in.
      if (response.status === 409 || response.status === 404) return 'unchanged'
      if (!response.ok) throw new OfflineError(`GitHub said ${String(response.status)}.`)
      const commit = ((await response.json()) as { object: { sha: string } }).object.sha
      const etag = response.headers.get('etag') ?? undefined
      if (file.base?.commit === commit) {
        await writeSync({ ...file, etag })
        return 'unchanged'
      }
      fetched = { commit, etag }
      return 'changed'
    },

    async mergeMain(): Promise<PullOutcome> {
      const file = await readSync()
      const head = fetched
      if (head === undefined) return { changed: [], asks: [], generated: [] }
      const { tree: top } = await json<{ tree: { sha: string } }>(`/git/commits/${head.commit}`)
      const listing = await json<{ truncated: boolean; tree: { path: string; type: string; sha: string }[] }>(
        `/git/trees/${top.sha}?recursive=1`,
      )
      if (listing.truncated) throw new SyncStopped(TOO_BIG)
      const theirs = new Map(
        listing.tree
          .filter((entry) => entry.type === 'blob' && !entry.path.startsWith(NOTES))
          .map((e) => [e.path, e.sha]),
      )
      const local = await localFiles()
      const listText = local.get(EDITOR_LIST)
      const folders = generatedFolders(listText === undefined ? undefined : decoder.decode(listText.bytes))
      const changed: string[] = []
      const generated: string[] = []
      const asks: MergeAsk[] = []
      const asked: AskedFile[] = []

      const paths = new Set([...local.keys(), ...theirs.keys(), ...Object.keys(file.files)])
      for (const path of paths) {
        const base = file.files[path]
        const mine = local.get(path)
        const there = theirs.get(path)
        if (there === base || mine?.sha === there) continue
        if (isGeneratedPath(path, folders)) {
          generated.push(path)
          continue
        }
        if (mine?.sha === base) {
          if (there === undefined) await store.remove(path)
          else await store.write(path, await blobBytes(there))
          changed.push(path)
          continue
        }
        const outcome = mergeFile(path, {
          ...(base === undefined ? {} : { base: await blobBytes(base) }),
          ...(mine === undefined ? {} : { mine: mine.bytes }),
          ...(there === undefined ? {} : { theirs: await blobBytes(there) }),
        })
        if (outcome.kind === 'merged') {
          await store.write(path, outcome.data)
          changed.push(path)
        } else if (outcome.kind === 'deleted') {
          await store.remove(path)
          changed.push(path)
        } else {
          // A file that changed on both sides can always be kept in both versions; only a deletion has no second copy.
          const keepBothPath =
            outcome.keepBothPath ?? (outcome.reason === 'both-changed' ? keepBothName(path) : undefined)
          const ask: MergeAsk = {
            path,
            reason: outcome.reason,
            ...(outcome.where === undefined ? {} : { where: outcome.where }),
            ...(keepBothPath === undefined ? {} : { keepBothPath }),
          }
          asks.push(ask)
          asked.push({ ...ask, theirs: there ?? null })
        }
      }
      const files: Record<string, string> = Object.fromEntries(theirs)
      for (const { path } of asked) {
        const old = file.files[path]
        if (old === undefined) delete files[path]
        else files[path] = old
      }
      await writeSync({
        ...file,
        base: { commit: head.commit, tree: top.sha },
        files,
        etag: head.etag,
        asked,
      })
      fetched = undefined
      return { changed, asks, generated }
    },

    async conflicts() {
      return ((await readSync()).asked ?? []).map(({ theirs: _, ...ask }) => ask)
    },

    async resolve(path, choice): Promise<Resolved> {
      const file = await readSync()
      const ask = file.asked?.find((each) => each.path === path)
      if (ask === undefined) return { changed: [] }
      // Everything that can fail on the network comes before the first write, so a lost connection changes nothing.
      const theirs = ask.theirs === null ? undefined : await blobBytes(ask.theirs)
      const changed: string[] = []
      const put = async (to: string, data: Uint8Array): Promise<void> => {
        const written = await store.write(to, data)
        if (!written.ok) throw new Error(written.message)
        changed.push(to)
      }
      if (choice === 'theirs') {
        if (theirs === undefined) {
          await store.remove(path)
          changed.push(path)
        } else await put(path, theirs)
      } else if (choice === 'both' && theirs !== undefined && ask.keepBothPath !== undefined)
        await put(await freeName(ask.keepBothPath), theirs)
      // Both sides now start from GitHub's version of the file: what is here is a change on top of it, and goes up next.
      const files = { ...file.files }
      if (ask.theirs === null) delete files[path]
      else files[path] = ask.theirs
      await writeSync({ ...file, files, asked: (file.asked ?? []).filter((each) => each.path !== path) })
      return { changed }
    },

    async commitAll(message) {
      const file = await readSync()
      if (changesHere(file, await localFiles()).size === 0) return undefined
      await writeSync({ ...file, pending: file.pending ?? { message, at: now() } })
      return 'pending'
    },

    // Also true for an edit saved here that no commit was made for: a page that went away inside the ten seconds.
    async hasUnpushed() {
      const file = await readSync()
      return file.pending !== undefined || changesHere(file, await localFiles()).size > 0
    },

    async push(): Promise<PushResult> {
      try {
        return await pushPending()
      } catch (error) {
        if (error instanceof OfflineError) return 'offline'
        throw error
      }
    },
  }

  async function pushPending(): Promise<PushResult> {
    let file = await branchOf(await readSync())
    const pending = file.pending ?? { message: 'Edited in Automata', at: now() }
    const local = await localFiles()
    const changes = changesHere(file, local)
    if (changes.size === 0) {
      await writeSync({ ...file, pending: undefined })
      return 'pushed'
    }
    const files: Record<string, string> = { ...file.files }

    if (file.base === undefined) {
      // Never brought in: an empty repository takes the first file through the Contents API; one that has commits has to be pulled first.
      const ref = await api(`/git/ref/heads/${file.branch}`)
      if (ref.ok) return 'rejected'
      if (ref.status !== 409 && ref.status !== 404)
        throw new OfflineError(`GitHub said ${String(ref.status)}.`)
      const first = changes.has(EDITOR_LIST)
        ? EDITOR_LIST
        : ([...changes.keys()].find((p) => changes.get(p) !== null) ?? '')
      const bytes = local.get(first)?.bytes
      if (bytes === undefined) return 'pushed'
      const put = await api(`/contents/${first.split('/').map(encodeURIComponent).join('/')}`, {
        method: 'PUT',
        body: JSON.stringify({ message: pending.message, content: toBase64(bytes) }),
      })
      if (!put.ok) throw new OfflineError(`GitHub said ${String(put.status)}.`)
      const made = (await put.json()) as {
        content: { sha: string }
        commit: { sha: string; tree: { sha: string } }
      }
      files[first] = made.content.sha
      changes.delete(first)
      file = {
        ...file,
        base: { commit: made.commit.sha, tree: made.commit.tree.sha },
        files,
        etag: undefined,
      }
      await writeSync(file)
    }
    const base = file.base
    if (base === undefined) return 'pushed'
    if (changes.size === 0) {
      await writeSync({ ...file, pending: undefined })
      return 'pushed'
    }

    const entries: { path: string; mode: '100644'; type: 'blob'; sha: string | null }[] = []
    for (const [path, sha] of changes) {
      if (sha === null) {
        entries.push({ path, mode: '100644', type: 'blob', sha: null })
        delete files[path]
        continue
      }
      const bytes = local.get(path)?.bytes ?? new Uint8Array()
      const made = await json<{ sha: string }>('/git/blobs', {
        method: 'POST',
        body: JSON.stringify({ content: toBase64(bytes), encoding: 'base64' }),
      })
      entries.push({ path, mode: '100644', type: 'blob', sha: made.sha })
      files[path] = made.sha
    }
    const tree = await json<{ sha: string }>('/git/trees', {
      method: 'POST',
      body: JSON.stringify({ base_tree: base.tree, tree: entries }),
    })
    const commit = await json<{ sha: string }>('/git/commits', {
      method: 'POST',
      body: JSON.stringify({ message: pending.message, tree: tree.sha, parents: [base.commit] }),
    })
    const moved = await api(`/git/refs/heads/${file.branch}`, {
      method: 'PATCH',
      body: JSON.stringify({ sha: commit.sha, force: false }),
    })
    if (moved.status === 422) return 'rejected'
    if (!moved.ok) throw new OfflineError(`GitHub said ${String(moved.status)}.`)
    await writeSync({
      ...file,
      base: { commit: commit.sha, tree: tree.sha },
      files,
      etag: undefined,
      pending: undefined,
    })
    return 'pushed'
  }
}
