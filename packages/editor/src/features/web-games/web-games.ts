// The person's games, kept in this browser's private storage as `games/<id>/` folders beside a small list
// (`games/games.json`). A browser that keeps nothing still lets them work: the games live in memory, `kept` is false and
// `reason` says why, so the page can say "Not saved" rather than pretend. The sample game's folder is not read here.
import { createOpfsStore, type DirectoryLike } from '../../shared/kit/storage/handle-store'
import { createMemoryStore } from '../../shared/kit/storage/memory-store'
import type { ProjectStore } from '../../shared/kit/storage/project-store'
import { openPrivateStores } from '../../shared/kit/storage/workspace'
import {
  type GameEntry,
  type LastOpened,
  gameId,
  newestFirst,
  parseIndex,
  rebuiltIndex,
  serializeIndex,
} from './games-index'

export type { GameEntry, LastOpened } from './games-index'

const ROOT = 'games'
const INDEX = 'games.json'
const decoder = new TextDecoder()

export interface WebGamesEnv {
  /** The browser's `navigator.storage`; hand in `{}` for a browser without OPFS. */
  readonly storage?: { getDirectory?: () => Promise<DirectoryLike> } | undefined
  /** The page's clock, in milliseconds. */
  now(): number
}

export interface WebGames {
  /** False when nothing is kept on this device. */
  readonly kept: boolean
  /** Why nothing is kept, when it is not. */
  readonly reason?: string | undefined
  /** Newest change first. */
  list(): Promise<readonly GameEntry[]>
  create(title: string, files: readonly { path: string; text: string }[]): Promise<GameEntry>
  /** The files of one game. */
  store(id: string): Promise<ProjectStore>
  /** The game changed just now. */
  touched(id: string): Promise<void>
  remove(id: string): Promise<void>
  /** The game (and editor) open when the page was last closed, if that game still exists. */
  last(): Promise<LastOpened | undefined>
  remember(game: string, editor?: string): Promise<void>
  /** Says which GitHub repository (`owner/name`) a game is kept on, or none. */
  link(id: string, repo: string | undefined): Promise<void>
}

export async function openWebGames(env: WebGamesEnv): Promise<WebGames> {
  const opened = await openPrivateStores([ROOT], env.storage)
  const kept = opened.persistent
  const rootStore = opened.persistent ? (opened.stores[0] ?? createMemoryStore()) : createMemoryStore()
  const memory = new Map<string, ProjectStore>()
  const getRoot = (): Promise<DirectoryLike> => {
    const getDirectory = env.storage?.getDirectory ?? navigator.storage.getDirectory.bind(navigator.storage)
    return getDirectory()
  }

  async function load() {
    const bytes = await rootStore.read(INDEX)
    const parsed = bytes === undefined ? undefined : parseIndex(decoder.decode(bytes))
    if (parsed !== undefined) return parsed
    const ids = new Set<string>()
    for (const entry of await rootStore.list()) {
      const first = entry.path.split('/')[0]
      if (first !== undefined && first !== INDEX) ids.add(first)
    }
    return rebuiltIndex([...ids], env.now())
  }

  let index = await load()
  // One change at a time, so two quick ones never write over each other's list.
  let queue: Promise<unknown> = Promise.resolve()
  const change = <T>(body: () => Promise<T>): Promise<T> => {
    const next = queue.then(body)
    queue = next.catch(() => undefined)
    return next
  }
  const save = async (): Promise<void> => {
    const written = await rootStore.write(INDEX, serializeIndex(index))
    if (!written.ok) throw new Error(written.message)
  }
  const gameStore = async (id: string): Promise<ProjectStore> => {
    if (!kept) {
      const have = memory.get(id) ?? createMemoryStore()
      memory.set(id, have)
      return have
    }
    return createOpfsStore({ directory: `${ROOT}/${id}`, getRoot })
  }
  const update = (id: string, patch: (entry: GameEntry) => GameEntry): void => {
    index = { ...index, games: index.games.map((game) => (game.id === id ? patch(game) : game)) }
  }

  return {
    kept,
    ...(opened.persistent ? {} : { reason: opened.reason }),
    list: () => Promise.resolve(newestFirst(index.games)),
    create: (title, files) =>
      change(async () => {
        const id = gameId(
          title,
          index.games.map((game) => game.id),
        )
        const store = await gameStore(id)
        for (const file of files) {
          const written = await store.write(file.path, file.text)
          if (!written.ok) throw new Error(written.message)
        }
        const entry: GameEntry = { id, title: title.trim() || id, changed: env.now() }
        index = { ...index, games: [...index.games, entry] }
        await save()
        return entry
      }),
    store: gameStore,
    touched: (id) =>
      change(async () => {
        update(id, (game) => ({ ...game, changed: env.now() }))
        await save()
      }),
    remove: (id) =>
      change(async () => {
        const store = await gameStore(id)
        for (const entry of await store.list()) await store.remove(entry.path)
        memory.delete(id)
        index = {
          games: index.games.filter((game) => game.id !== id),
          ...(index.last !== undefined && index.last.game !== id ? { last: index.last } : {}),
        }
        await save()
      }),
    last: () => Promise.resolve(index.last && index.games.some((game) => game.id === index.last?.game) ? index.last : undefined),
    remember: (game, editor) =>
      change(async () => {
        index = { ...index, last: editor === undefined ? { game } : { game, editor } }
        await save()
      }),
    link: (id, repo) =>
      change(async () => {
        update(id, ({ github: _old, ...rest }) => (repo === undefined ? rest : { ...rest, github: repo }))
        await save()
      }),
  }
}
