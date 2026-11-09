import { createHash } from 'node:crypto'
import { blobId } from '#src/shared/kit/sync/blob-id.ts'

// A repository in memory that answers the REST routes the web engine uses, the way GitHub does: refs with ETags, an
// empty repository that refuses the Git Data API, trees with `sha: null` for a deletion, a ref that moves only forward,
// a network that can go away and a rate limit. `remoteWrite` is another device pushing.

const decoder = new TextDecoder()
const encoder = new TextEncoder()
const sha1 = (text: string): string => createHash('sha1').update(text).digest('hex')

interface Commit {
  readonly tree: string
  readonly parent: string | undefined
  readonly message: string
}

export interface FakeRestOptions {
  readonly repo: string
  readonly defaultBranch?: string
  /** Files already in the repository, as one first commit. */
  readonly files?: Readonly<Record<string, string>>
}

export interface FakeGitHubRest {
  readonly fetch: typeof fetch
  readonly state: { offline: boolean; rateLimited: boolean; truncated: boolean; down: boolean }
  readonly log: { method: string; path: string; headers: Headers; body: unknown }[]
  /** Another device pushed `files` (a text, or `null` to delete). */
  remoteWrite(files: Record<string, string | null>, message?: string): Promise<void>
  head(): string | undefined
  /** Commit messages from the oldest, as a history shows them. */
  messages(): string[]
  file(path: string): string | undefined
  paths(): string[]
  count(method: string, path: RegExp | string): number
}

export function createFakeGitHubRest(options: FakeRestOptions): FakeGitHubRest {
  const branch = options.defaultBranch ?? 'main'
  const blobs = new Map<string, Uint8Array>()
  const trees = new Map<string, Map<string, string>>()
  const commits = new Map<string, Commit>()
  let head: string | undefined
  const history: string[] = []
  const log: { method: string; path: string; headers: Headers; body: unknown }[] = []
  const state = { offline: false, rateLimited: false, truncated: false, down: false }

  async function putBlob(bytes: Uint8Array): Promise<string> {
    const id = await blobId(bytes)
    blobs.set(id, bytes)
    return id
  }

  async function commitFiles(
    files: Map<string, string>,
    message: string,
    parent: string | undefined,
  ): Promise<string> {
    const treeId = sha1(`tree ${JSON.stringify([...files].sort())}`)
    trees.set(treeId, files)
    const id = sha1(`commit ${treeId} ${parent ?? ''} ${message} ${String(history.length)}`)
    commits.set(id, { tree: treeId, parent, message })
    history.push(id)
    return id
  }

  const seed = async (): Promise<void> => {
    if (options.files === undefined) return
    const map = new Map<string, string>()
    for (const [path, text] of Object.entries(options.files))
      map.set(path, await putBlob(encoder.encode(text)))
    head = await commitFiles(map, 'First', undefined)
  }
  const ready = seed()

  const json = (body: unknown, status = 200, headers: Record<string, string> = {}): Response =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json', ...headers },
    })

  const fetchFn = (async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    await ready
    if (state.offline) throw new TypeError('Failed to fetch')
    const url = new URL(String(input))
    const method = init?.method ?? 'GET'
    const headers = new Headers(init?.headers)
    const body =
      typeof init?.body === 'string' ? (JSON.parse(init.body) as Record<string, unknown>) : undefined
    const path = url.pathname.replace(`/repos/${options.repo}`, '')
    log.push({ method, path, headers, body })
    if (state.rateLimited) return json({ message: 'rate limit' }, 403, { 'retry-after': '90' })
    if (state.down) return json({ message: 'Server Error' }, 500)

    if (method === 'GET' && path === '') return json({ default_branch: branch })
    if (method === 'GET' && path === `/git/ref/heads/${branch}`) {
      if (head === undefined) return json({ message: 'Git Repository is empty.' }, 409)
      const etag = `"${head}"`
      if (headers.get('if-none-match') === etag) return new Response(null, { status: 304 })
      return json({ ref: `refs/heads/${branch}`, object: { sha: head } }, 200, { etag })
    }
    const commit = /^\/git\/commits\/(\w+)$/.exec(path)
    if (method === 'GET' && commit !== null) {
      const found = commits.get(commit[1] ?? '')
      return found === undefined ? json({}, 404) : json({ sha: commit[1], tree: { sha: found.tree } })
    }
    const tree = /^\/git\/trees\/(\w+)$/.exec(path)
    if (method === 'GET' && tree !== null) {
      const found = trees.get(tree[1] ?? '')
      if (found === undefined) return json({}, 404)
      return json({
        sha: tree[1],
        truncated: state.truncated,
        tree: [...found].map(([p, sha]) => ({ path: p, mode: '100644', type: 'blob', sha })),
      })
    }
    const blob = /^\/git\/blobs\/(\w+)$/.exec(path)
    if (method === 'GET' && blob !== null) {
      const found = blobs.get(blob[1] ?? '')
      return found === undefined
        ? json({}, 404)
        : json({ sha: blob[1], encoding: 'base64', content: Buffer.from(found).toString('base64') })
    }
    if (method === 'POST' && path === '/git/blobs') {
      if (head === undefined) return json({ message: 'Git Repository is empty.' }, 409)
      return json({ sha: await putBlob(Buffer.from(String(body?.['content']), 'base64')) }, 201)
    }
    if (method === 'POST' && path === '/git/trees') {
      if (head === undefined) return json({ message: 'Git Repository is empty.' }, 409)
      const files = new Map(trees.get(String(body?.['base_tree'])) ?? [])
      for (const entry of (body?.['tree'] ?? []) as { path: string; sha: string | null }[])
        if (entry.sha === null) files.delete(entry.path)
        else files.set(entry.path, entry.sha)
      const id = sha1(`tree ${JSON.stringify([...files].sort())}`)
      trees.set(id, files)
      return json({ sha: id }, 201)
    }
    if (method === 'POST' && path === '/git/commits') {
      if (head === undefined) return json({ message: 'Git Repository is empty.' }, 409)
      const parents = body?.['parents'] as string[]
      const id = sha1(
        `commit ${String(body?.['tree'])} ${parents.join(',')} ${String(body?.['message'])} ${String(commits.size)}`,
      )
      commits.set(id, {
        tree: String(body?.['tree']),
        parent: parents[0],
        message: String(body?.['message']),
      })
      return json({ sha: id }, 201)
    }
    if (method === 'PATCH' && path === `/git/refs/heads/${branch}`) {
      const next = String(body?.['sha'])
      if (commits.get(next)?.parent !== head) return json({ message: 'Update is not a fast forward' }, 422)
      head = next
      history.push(next)
      return json({ object: { sha: next } })
    }
    const contents = /^\/contents\/(.+)$/.exec(path)
    if (method === 'PUT' && contents !== null) {
      const bytes = Buffer.from(String(body?.['content']), 'base64')
      const id = await putBlob(bytes)
      const files = new Map(head === undefined ? [] : trees.get(commits.get(head)?.tree ?? ''))
      files.set(decodeURIComponent(contents[1] ?? ''), id)
      head = await commitFiles(files, String(body?.['message']), head)
      return json(
        { content: { sha: id }, commit: { sha: head, tree: { sha: commits.get(head)?.tree } } },
        201,
      )
    }
    return json({ message: `unexpected ${method} ${path}` }, 500)
  }) as typeof fetch

  return {
    fetch: fetchFn,
    state,
    log,
    /** Another device pushed `files` (a text, or `null` to delete). */
    async remoteWrite(files: Record<string, string | null>, message = 'From elsewhere'): Promise<void> {
      await ready
      const map = new Map(head === undefined ? [] : trees.get(commits.get(head)?.tree ?? ''))
      for (const [path, text] of Object.entries(files))
        if (text === null) map.delete(path)
        else map.set(path, await putBlob(encoder.encode(text)))
      head = await commitFiles(map, message, head)
    },
    head: () => head,
    /** Commit messages from the oldest, as a history shows them. */
    messages: (): string[] => {
      const out: string[] = []
      for (let at = head; at !== undefined; at = commits.get(at)?.parent)
        out.unshift(commits.get(at)?.message ?? '')
      return out
    },
    file(path: string): string | undefined {
      const sha = head === undefined ? undefined : trees.get(commits.get(head)?.tree ?? '')?.get(path)
      const bytes = sha === undefined ? undefined : blobs.get(sha)
      return bytes === undefined ? undefined : decoder.decode(bytes)
    },
    paths: (): string[] =>
      head === undefined ? [] : [...(trees.get(commits.get(head)?.tree ?? '') ?? [])].map(([p]) => p).sort(),
    count: (method: string, path: RegExp | string): number =>
      log.filter(
        (call) =>
          call.method === method && (typeof path === 'string' ? call.path === path : path.test(call.path)),
      ).length,
  }
}
