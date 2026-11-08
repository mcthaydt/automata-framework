// "Save a copy" and "Open a copy": a game as one .zip the person keeps wherever they like, and a .zip they saved
// back into the person's games. A zip from anywhere else is read with care: a path that climbs out of the game, a file
// too big to be a game's, or no editor list at all is refused with the reason in words, and nothing is made.
import { strToU8, unzipSync, zipSync } from 'fflate'
import type { ProjectStore } from '../../shared/kit/storage/project-store'
import type { GameEntry, GameFile, WebGames } from './web-games'

const EDITOR_LIST = 'content/editors.toml'
/** A file over this is never inflated. */
const MAX_FILE_BYTES = 16 * 1024 * 1024
/** What sync keeps beside the game; it is never part of a copy. */
const NOTES = '.automata/'
const NOT_A_GAME = 'This isn’t an Automata game. Pick a .zip you saved from Automata.'

export async function saveCopy(store: ProjectStore): Promise<Uint8Array> {
  const files: Record<string, Uint8Array> = {}
  for (const entry of await store.list()) {
    if (entry.path.startsWith(NOTES)) continue
    files[entry.path] = (await store.read(entry.path)) ?? strToU8('')
  }
  return zipSync(files)
}

export type OpenedCopy =
  | { readonly ok: true; readonly game: GameEntry }
  | { readonly ok: false; readonly why: string }

const safe = (path: string): boolean =>
  path !== '' &&
  !path.startsWith('/') &&
  !path.includes('\\') &&
  !path.split('/').some((part) => part === '..' || part === '')

/** `title` names the game; without one, the folder the files sat in, or "My game". */
export async function openCopy(zip: Uint8Array, games: WebGames, title?: string): Promise<OpenedCopy> {
  let tooBig: string | undefined
  let entries: Record<string, Uint8Array>
  try {
    entries = unzipSync(zip, {
      filter: (file) => {
        if (file.name.endsWith('/') || file.name.startsWith('__MACOSX/')) return false
        if (file.originalSize > MAX_FILE_BYTES) {
          tooBig ??= file.name
          return false
        }
        return true
      },
    })
  } catch {
    return { ok: false, why: NOT_A_GAME }
  }
  if (tooBig !== undefined)
    return { ok: false, why: `${tooBig} is too big for a game (the limit is 16 MB for one file).` }

  const names = Object.keys(entries)
  // One folder around everything is how most tools zip a folder: the game is what is inside it.
  const top = names[0]?.split('/')[0]
  const wrapped =
    top !== undefined && !names.includes(EDITOR_LIST) && names.every((name) => name.startsWith(`${top}/`))
  const files: GameFile[] = []
  for (const name of names) {
    const path = wrapped ? name.slice(top.length + 1) : name
    if (!safe(path) || path.startsWith(NOTES)) return { ok: false, why: NOT_A_GAME }
    files.push({ path, bytes: entries[name] ?? new Uint8Array() })
  }
  if (!files.some((file) => file.path === EDITOR_LIST)) return { ok: false, why: NOT_A_GAME }
  const game = await games.create(title?.trim() || (wrapped ? top : undefined) || 'My game', files)
  return { ok: true, game }
}
