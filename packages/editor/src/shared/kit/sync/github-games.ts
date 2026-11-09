// Which of the person's GitHub repositories are Automata games, and getting one onto this device. The app is installed on
// the repositories the person chose, so the list is what the app can see (never a search of all of GitHub); a repository
// is a game when it holds the editor list. Getting a game writes its files and the note sync needs (`.automata/sync.json`)
// at the commit read, so the first sync has nothing to guess. Plain TypeScript: the network and the shelf are handed in.
import type { ProjectStore } from '../storage/project-store'
import { blobId } from './blob-id'
import type { SyncFile } from './rest-engine'

const API = 'https://api.github.com'
const EDITOR_LIST = 'content/editors.toml'
const SYNC_FILE = '.automata/sync.json'
const SIGN_IN_AGAIN = 'Sign in to GitHub again to see your games.'
const TOO_BIG = 'This game is too big to get on the web. Use the Automata app.'

/** A repository that holds a game. */
export interface GitHubGame {
  /** `owner/name`. */
  readonly repo: string
  /** What the game would be called here, from the repository's name. */
  readonly id: string
  readonly title: string
}

/** The part of the shelf of games that getting one needs; the page's `WebGames` is one. */
export interface GameShelf {
  create(
    title: string,
    files: readonly { readonly path: string; readonly bytes: Uint8Array }[],
  ): Promise<{ readonly id: string; readonly title: string; readonly changed: number }>
  store(id: string): Promise<ProjectStore>
  link(id: string, repo: string | undefined): Promise<void>
}

export interface GotGame {
  readonly id: string
  readonly title: string
  readonly changed: number
  readonly github: string
}

/** Where to make an empty private repository named for the game. */
export const newRepoUrl = (id: string): string =>
  `https://github.com/new?name=${encodeURIComponent(id)}&visibility=private`

/** Where the person chooses which repositories Automata may see. */
export const installUrl = (slug: string): string =>
  `https://github.com/apps/${encodeURIComponent(slug)}/installations/new`

async function call(fetchFn: typeof fetch, token: string, url: string): Promise<Response> {
  const response = await fetchFn(url, {
    headers: {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      Authorization: `Bearer ${token}`,
    },
  })
  if (response.status === 401) throw new Error(SIGN_IN_AGAIN)
  return response
}

/** A repository's name as a game's title: `lantern-run` is "Lantern Run" (the name was made from the title). */
export function titleOfRepo(name: string): string {
  const words = name.split(/[-_]+/).filter((word) => word !== '')
  return words.length === 0
    ? name
    : words.map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
}

/** Every item of a list GitHub pages through, following `Link: rel="next"` only while it stays on GitHub's API. */
async function allOf<T>(fetchFn: typeof fetch, token: string, first: string, key: string): Promise<T[]> {
  const found: T[] = []
  for (let url: string | undefined = first, pages = 0; url !== undefined && pages < 20; pages++) {
    const response = await call(fetchFn, token, url)
    if (!response.ok) throw new Error(`GitHub said ${String(response.status)}.`)
    const body = (await response.json()) as Record<string, unknown>
    const items = body[key]
    if (Array.isArray(items)) found.push(...(items as T[]))
    const next = /<([^>]+)>;\s*rel="next"/.exec(response.headers.get('link') ?? '')?.[1]
    url = next?.startsWith(`${API}/`) ? next : undefined
  }
  return found
}

/** Every repository (`owner/name`) of every installation of the app the person can reach. */
async function installedRepos(fetchFn: typeof fetch, token: string): Promise<string[]> {
  const installations = await allOf<{ id: number }>(
    fetchFn,
    token,
    `${API}/user/installations?per_page=100`,
    'installations',
  )
  const repos: string[] = []
  for (const { id } of installations)
    for (const row of await allOf<{ full_name: string }>(
      fetchFn,
      token,
      `${API}/user/installations/${String(id)}/repositories?per_page=100`,
      'repositories',
    ))
      repos.push(row.full_name)
  return repos
}

/** The repositories the app can see that hold a game. */
export async function listGitHubGames(fetchFn: typeof fetch, token: string): Promise<readonly GitHubGame[]> {
  const games: GitHubGame[] = []
  for (const repo of await installedRepos(fetchFn, token)) {
    const response = await call(fetchFn, token, `${API}/repos/${repo}/contents/${EDITOR_LIST}`)
    if (!response.ok) continue
    const name = repo.split('/')[1] ?? repo
    games.push({ repo, id: name.toLowerCase(), title: titleOfRepo(name) })
  }
  return games
}

/** Whether the app was let into `repo` (empty or not); false, not an error, when GitHub cannot be reached. */
export async function repoReachable(fetchFn: typeof fetch, token: string, repo: string): Promise<boolean> {
  try {
    return (await installedRepos(fetchFn, token)).some((found) => found.toLowerCase() === repo.toLowerCase())
  } catch {
    return false
  }
}

const decode = (text: string): Uint8Array =>
  Uint8Array.from(atob(text.replace(/\s/g, '')), (c) => c.charCodeAt(0))

/** Makes a game here from the files of `repo`'s default branch, notes the commit they came from, and links the two. */
export async function getGame(
  fetchFn: typeof fetch,
  token: string,
  repo: string,
  games: GameShelf,
): Promise<GotGame> {
  const get = async <T>(path: string): Promise<{ body: T; response: Response }> => {
    const response = await call(fetchFn, token, `${API}/repos/${repo}${path}`)
    if (!response.ok) throw new Error(`GitHub said ${String(response.status)}.`)
    return { body: (await response.json()) as T, response }
  }
  const { default_branch: branch } = (await get<{ default_branch: string }>('')).body
  const ref = await get<{ object: { sha: string } }>(`/git/ref/heads/${branch}`)
  const commit = ref.body.object.sha
  const tree = (await get<{ tree: { sha: string } }>(`/git/commits/${commit}`)).body.tree.sha
  const listing = (
    await get<{ truncated: boolean; tree: { path: string; type: string; sha: string }[] }>(
      `/git/trees/${tree}?recursive=1`,
    )
  ).body
  if (listing.truncated) throw new Error(TOO_BIG)

  const files: { path: string; bytes: Uint8Array }[] = []
  const ids: Record<string, string> = {}
  for (const entry of listing.tree) {
    if (entry.type !== 'blob' || entry.path.startsWith('.automata/')) continue
    const bytes = decode((await get<{ content: string }>(`/git/blobs/${entry.sha}`)).body.content)
    files.push({ path: entry.path, bytes })
    ids[entry.path] = await blobId(bytes)
  }

  const name = repo.split('/')[1] ?? repo
  const made = await games.create(titleOfRepo(name), files)
  const note: SyncFile = {
    repo,
    branch,
    base: { commit, tree },
    files: ids,
    etag: ref.response.headers.get('etag') ?? undefined,
  }
  const store = await games.store(made.id)
  const written = await store.write(SYNC_FILE, `${JSON.stringify(note, null, 2)}\n`)
  if (!written.ok) throw new Error(written.message)
  await games.link(made.id, repo)
  return { ...made, github: repo }
}
