// The list of the person's games kept in this browser: which exist, what they are called, when each last changed, and
// which one was open last. It is a small file beside the games' folders; if it is lost or damaged the folders are the
// truth and the list is made again from them.

export interface GameEntry {
  readonly id: string
  readonly title: string
  /** Milliseconds since the epoch, from the clock the page was given. */
  readonly changed: number
  /** `owner/name` of the GitHub repository this game is kept on, when it is. */
  readonly github?: string | undefined
}

export interface LastOpened {
  readonly game: string
  readonly editor?: string | undefined
}

export interface GamesIndex {
  readonly games: readonly GameEntry[]
  readonly last?: LastOpened | undefined
}

const FORMAT = 'af-games/1'

/** Matches the ids `create-game` accepts, so a game made here is a game the tools open. */
const ID = /^[a-z0-9]+(-[a-z0-9]+)*$/

/** "Lantern Run" gives `lantern-run`; a name already used gets `-2`, `-3`; a name with nothing usable gives `my-game`. */
export function gameId(title: string, taken: readonly string[]): string {
  const base =
    title
      .normalize('NFKD')
      .replace(/\p{M}/gu, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'my-game'
  if (!taken.includes(base)) return base
  for (let n = 2; ; n++) {
    const next = `${base}-${String(n)}`
    if (!taken.includes(next)) return next
  }
}


function entryOf(value: unknown): GameEntry | undefined {
  if (typeof value !== 'object' || value === null) return undefined
  const { id, title, changed, github } = value as Record<string, unknown>
  if (typeof id !== 'string' || !ID.test(id) || typeof title !== 'string' || typeof changed !== 'number')
    return undefined
  return typeof github === 'string' ? { id, title, changed, github } : { id, title, changed }
}

export function parseIndex(text: string): GamesIndex | undefined {
  try {
    const raw: unknown = JSON.parse(text)
    if (typeof raw !== 'object' || raw === null) return undefined
    const { format, games, last } = raw as Record<string, unknown>
    if (format !== FORMAT || !Array.isArray(games)) return undefined
    const entries = games.map(entryOf)
    if (entries.some((entry) => entry === undefined)) return undefined
    const kept = entries.filter((entry): entry is GameEntry => entry !== undefined)
    const opened = last as Record<string, unknown> | null | undefined
    if (typeof opened?.['game'] !== 'string') return { games: kept }
    const editor = opened['editor']
    return {
      games: kept,
      last: typeof editor === 'string' ? { game: opened['game'], editor } : { game: opened['game'] },
    }
  } catch {
    return undefined
  }
}

export function serializeIndex(index: GamesIndex): string {
  return `${JSON.stringify({ format: FORMAT, games: index.games, ...(index.last ? { last: index.last } : {}) }, null, 2)}\n`
}

/** The list made again from the folders found, when the file that held it is gone. Names are the ids until renamed. */
export function rebuiltIndex(ids: readonly string[], now: number): GamesIndex {
  return {
    games: [...ids]
      .filter((id) => ID.test(id))
      .sort()
      .map((id) => ({ id, title: id, changed: now })),
  }
}

/** Newest change first; ties keep the order they were in. */
export const newestFirst = (games: readonly GameEntry[]): readonly GameEntry[] =>
  [...games].sort((a, b) => b.changed - a.changed)
