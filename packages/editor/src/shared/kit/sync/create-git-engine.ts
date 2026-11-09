import git, {
  type CallbackFsClient,
  type HttpClient,
  type PromiseFsClient,
  TREE,
  WORKDIR,
} from 'isomorphic-git'
import { generatedFolders, isGeneratedPath } from './generated-files'
import { type GitEngine, type MergeAsk, OfflineError, type PullOutcome, type PushResult } from './git-engine'
import { mergeFile } from './merge-drivers'

// The git engine for a game's folder, over isomorphic-git: it works in a page, so the Automata app and the web editors
// share it. The folder and the network come in as arguments (the app's file plugin and HTTP client, or a test's real
// folder and server). It never pushes with force, and it never writes a conflict marker: a file that cannot merge is
// handed back as a question and left as it was.

export type GitFs = PromiseFsClient | CallbackFsClient

export interface GitEngineOptions {
  readonly fs: GitFs
  readonly http: HttpClient
  /** The game's folder. */
  readonly dir: string
  readonly author: { readonly name: string; readonly email: string }
  /** The GitHub token to push and fetch with; none for a server that needs no sign-in. */
  readonly token?: () => Promise<string | undefined>
  /** The branch the game keeps itself on. */
  readonly branch?: string
}

/** What the sync loop needs, and what the Review page and the new-game flow need besides. */
export interface GitEngineApi extends GitEngine {
  readonly dir: string
  clone(url: string): Promise<void>
  head(): Promise<string>
  fetchBranch(name: string): Promise<void>
  checkoutNewBranch(name: string): Promise<void>
  pushBranch(name: string): Promise<PushResult>
  /** A branch's files written into `outDir`, without moving HEAD or touching the game. */
  exportTree(ref: string, outDir: string): Promise<void>
  /** A new commit that puts back, for the files a merge changed, what they were before it. */
  revertMerge(sha: string, message: string): Promise<string>
}

type Bytes = Uint8Array

const textOf = (data: Bytes | undefined): string => (data === undefined ? '' : new TextDecoder().decode(data))

function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  return a.length === b.length && a.every((byte, index) => byte === b[index])
}

export function createGitEngine(options: GitEngineOptions): GitEngineApi {
  const { fs, http, dir, author } = options
  const branch = options.branch ?? 'main'
  const files = 'promises' in fs ? fs.promises : (fs as never as PromiseFsClient['promises'])
  const base = { fs, dir }
  const remoteMain = `refs/remotes/origin/${branch}`

  const onAuth = async (): Promise<{ username?: string; password?: string }> => {
    const token = await options.token?.()
    return token === undefined ? {} : { username: 'x-access-token', password: token }
  }

  /** What the network threw, as "offline", unless GitHub answered and refused. */
  function networkProblem(error: unknown): never {
    const code = (error as { code?: string }).code
    const status = (error as { data?: { statusCode?: number } }).data?.statusCode
    if (code === 'HttpError' && (status === 401 || status === 403 || status === 404)) throw error
    throw new OfflineError()
  }

  const join = (...parts: string[]): string => parts.join('/').replace(/\/+/g, '/')
  const resolve = (ref: string): Promise<string> => git.resolveRef({ ...base, ref })
  const tryResolve = async (ref: string): Promise<string | undefined> => {
    try {
      return await resolve(ref)
    } catch {
      return undefined
    }
  }

  async function readAt(oid: string, filepath: string): Promise<Bytes | undefined> {
    try {
      return (await git.readBlob({ ...base, oid, filepath })).blob
    } catch {
      return undefined
    }
  }

  async function readHere(path: string): Promise<Bytes | undefined> {
    try {
      return (await files.readFile(join(dir, path))) as Bytes
    } catch {
      return undefined
    }
  }

  async function writeHere(path: string, data: Bytes | string): Promise<void> {
    await mkdirs(join(dir, path.split('/').slice(0, -1).join('/')))
    await files.writeFile(join(dir, path), data)
  }

  async function mkdirs(folder: string): Promise<void> {
    let built = ''
    for (const part of folder.split('/').filter(Boolean)) {
      built += `/${part}`
      try {
        await files.mkdir(built)
      } catch {
        // Already there.
      }
    }
  }

  /** The files whose contents differ between two commits, with the file's state on each side. */
  async function changedBetween(a: string, b: string): Promise<string[]> {
    const changed: string[] = []
    await git.walk({
      ...base,
      trees: [TREE({ ref: a }), TREE({ ref: b })],
      map: async (path, [left, right]) => {
        if (path === '.') return
        const kinds = await Promise.all([left?.type(), right?.type()])
        if (kinds.every((kind) => kind === 'tree' || kind === undefined)) return
        if (kinds.some((kind) => kind === 'tree') && kinds.some((kind) => kind === 'blob')) return
        const ids = await Promise.all([left?.oid(), right?.oid()])
        if (ids[0] !== ids[1]) changed.push(path)
      },
    })
    return changed.sort()
  }

  // Compares the folder with HEAD by content. git's own status shortcut trusts size and whole seconds, so a same-size
  // edit in the second after a checkout (a pull, then a save) would be missed. A game's folder is small enough to read.
  async function changes(): Promise<{ path: string; removed: boolean }[]> {
    const found: { path: string; removed: boolean }[] = []
    await git.walk({
      ...base,
      trees: [TREE({ ref: 'HEAD' }), WORKDIR()],
      map: async (path, [head, work]) => {
        if (path === '.') return
        const kinds = await Promise.all([head?.type(), work?.type()])
        if (kinds[0] === 'tree' || kinds[1] === 'tree') {
          if (kinds[0] === 'tree' && !work) return
          if (kinds[1] === 'tree' && (await git.isIgnored({ ...base, filepath: path }))) return null
          return
        }
        if (await git.isIgnored({ ...base, filepath: path })) return
        if (!work) {
          found.push({ path, removed: true })
          return
        }
        const mine = (await work.content()) ?? new Uint8Array()
        const theirs = !head ? undefined : ((await head.content()) ?? new Uint8Array())
        if (theirs === undefined || !sameBytes(mine, theirs)) found.push({ path, removed: false })
      },
    })
    return found
  }

  async function isDirty(): Promise<boolean> {
    return (await changes()).length > 0
  }

  async function stage(): Promise<boolean> {
    const found = await changes()
    for (const { path, removed } of found) {
      if (removed) await git.remove({ ...base, filepath: path })
      else await git.add({ ...base, filepath: path })
    }
    return found.length > 0
  }

  async function commitAll(message: string): Promise<string | undefined> {
    if (!(await stage())) return undefined
    return git.commit({ ...base, message, author })
  }

  async function pushRef(ref: string): Promise<PushResult> {
    try {
      const result = await git.push({ ...base, http, onAuth, remote: 'origin', ref, force: false })
      return result.ok ? 'pushed' : 'rejected'
    } catch (error) {
      if ((error as { code?: string }).code === 'PushRejectedError') return 'rejected'
      try {
        networkProblem(error)
      } catch (offline) {
        if (offline instanceof OfflineError) return 'offline'
        throw offline
      }
      return 'offline'
    }
  }

  async function mergeMain(): Promise<PullOutcome> {
    const nothing: PullOutcome = { changed: [], asks: [], generated: [] }
    if (await isDirty()) await commitAll('Edited in Automata')
    const ours = await resolve('HEAD')
    const theirs = await tryResolve(remoteMain)
    if (theirs === undefined || theirs === ours) return nothing
    if (await git.isDescendent({ ...base, oid: ours, ancestor: theirs })) return nothing

    const generated = generatedFolders(textOf((await readHere('content/editors.toml')) ?? undefined))
    if (await git.isDescendent({ ...base, oid: theirs, ancestor: ours })) {
      const changed = await changedBetween(ours, theirs)
      // A generated file edited on GitHub is not taken, even when nothing here diverged: it goes through the merge.
      if (!changed.some((path) => isGeneratedPath(path, generated))) {
        await git.writeRef({ ...base, ref: `refs/heads/${branch}`, value: theirs, force: true })
        await git.checkout({ ...base, ref: branch, force: true })
        return { changed, asks: [], generated: [] }
      }
    }

    const [mergeBase] = await git.findMergeBase({ ...base, oids: [ours, theirs] })
    if (mergeBase === undefined) return nothing
    const theirChanges = await changedBetween(mergeBase, theirs)
    const writes: { path: string; data: Bytes | 'deleted' }[] = []
    const asks: MergeAsk[] = []
    const notes: string[] = []
    for (const path of theirChanges) {
      if (isGeneratedPath(path, generated)) {
        notes.push(path)
        continue
      }
      const outcome = mergeFile(path, {
        ...optional('base', await readAt(mergeBase, path)),
        ...optional('mine', await readHere(path)),
        ...optional('theirs', await readAt(theirs, path)),
      })
      if (outcome.kind === 'ask') {
        asks.push({
          path,
          reason: outcome.reason,
          ...(outcome.where === undefined ? {} : { where: outcome.where }),
          ...(outcome.keepBothPath === undefined ? {} : { keepBothPath: outcome.keepBothPath }),
        })
      } else if (outcome.kind === 'deleted') {
        if ((await readHere(path)) !== undefined) writes.push({ path, data: 'deleted' })
      } else {
        const data = typeof outcome.data === 'string' ? new TextEncoder().encode(outcome.data) : outcome.data
        const here = await readHere(path)
        if (here === undefined || textOf(here) !== textOf(data)) writes.push({ path, data })
      }
    }
    if (asks.length > 0) return { changed: [], asks, generated: notes }

    for (const { path, data } of writes) {
      if (data === 'deleted') {
        await files.unlink(join(dir, path))
        await git.remove({ ...base, filepath: path })
      } else {
        await writeHere(path, data)
        await git.add({ ...base, filepath: path })
      }
    }
    await git.commit({
      ...base,
      message: 'Bring in changes from GitHub',
      author,
      parent: [ours, theirs],
    })
    return { changed: writes.map((write) => write.path).sort(), asks: [], generated: notes }
  }

  return {
    dir,

    async clone(url) {
      try {
        await git.clone({ ...base, http, onAuth, url, ref: branch, singleBranch: true })
      } catch (error) {
        networkProblem(error)
      }
    },

    head: () => resolve('HEAD'),

    async fetchMain() {
      try {
        await git.fetch({
          ...base,
          http,
          onAuth,
          remote: 'origin',
          ref: branch,
          singleBranch: true,
          tags: false,
        })
      } catch (error) {
        networkProblem(error)
      }
      const remote = await tryResolve(remoteMain)
      const head = await resolve('HEAD')
      if (remote === undefined || remote === head) return 'unchanged'
      return (await git.isDescendent({ ...base, oid: head, ancestor: remote })) ? 'unchanged' : 'changed'
    },

    mergeMain,
    commitAll,

    async hasUnpushed() {
      const remote = await tryResolve(remoteMain)
      const head = await resolve('HEAD')
      if (remote === undefined) return true
      if (remote === head) return false
      return git.isDescendent({ ...base, oid: head, ancestor: remote })
    },

    push: () => pushRef(branch),

    async fetchBranch(name) {
      try {
        await git.fetch({
          ...base,
          http,
          onAuth,
          remote: 'origin',
          ref: name,
          singleBranch: true,
          tags: false,
        })
      } catch (error) {
        networkProblem(error)
      }
    },

    async checkoutNewBranch(name) {
      await git.branch({ ...base, ref: name, checkout: true })
    },

    pushBranch: (name) => pushRef(name),

    async exportTree(ref, outDir) {
      const oid = (await tryResolve(ref)) ?? (await resolve(`refs/remotes/origin/${ref}`))
      for (const filepath of await git.listFiles({ ...base, ref: oid })) {
        const blob = await readAt(oid, filepath)
        if (blob === undefined) continue
        await mkdirs(join(outDir, filepath.split('/').slice(0, -1).join('/')))
        await files.writeFile(join(outDir, filepath), blob)
      }
    },

    async revertMerge(sha, message) {
      const { commit } = await git.readCommit({ ...base, oid: sha })
      const first = commit.parent[0]
      if (first === undefined) throw new Error('That commit is not a merge.')
      for (const path of await changedBetween(first, sha)) {
        const before = await readAt(first, path)
        if (before === undefined) {
          await files.unlink(join(dir, path))
          await git.remove({ ...base, filepath: path })
        } else {
          await writeHere(path, before)
          await git.add({ ...base, filepath: path })
        }
      }
      return git.commit({ ...base, message, author })
    },
  }
}

/** `{ [key]: value }` when there is a value, so a missing file is left out rather than set to `undefined`. */
function optional<K extends 'base' | 'mine' | 'theirs'>(
  key: K,
  value: Bytes | undefined,
): { [P in K]?: Bytes } {
  return (value === undefined ? {} : { [key]: value }) as { [P in K]?: Bytes }
}
