import type { Workspace } from '../storage/workspace'

// The words and rules of a project list that every editor's Home shares: searching, the selection and how it moves, the age and size on a card,
// and the storage notes. An editor turns each of its entries into a `HomeCard`, so nothing here knows a file format.

const plural = (count: number, one: string, many: string): string => `${count} ${count === 1 ? one : many}`

export type Tone = 'ok' | 'warn' | 'bad' | 'neutral'

/** What a card shows for one project. An editor maps its own list entries to these. */
export interface HomeCard {
  readonly path: string
  /** The project's own name for itself, else its file's name. */
  readonly title: string
  /** What its checks found, or why it cannot be opened plainly. */
  readonly badge: { readonly tone: Tone; readonly text: string }
  /** What kind of project it is, in words: the profile's label. */
  readonly kind: string
  /** The CSS variable of the kind's colour (`--color-layer-sky`); none for a project of no single kind. */
  readonly accent: string | undefined
  readonly size: number
  readonly mtime: number
  /** A picture for the card's tile in place of the initial; none, the tile shows the initial. */
  readonly preview?: TilePreview | undefined
}

/** How a card draws its tile's picture. */
export interface TilePreview {
  /** Names what `draw` draws: the card draws again when it changes, and only then. */
  readonly key: string
  /** The picture's URL, or `undefined` when none could be drawn. */
  draw(): Promise<string | undefined>
}

// --- search -----------------------------------------------------------------------------------------------------

/** The words a search looks through for a card: its path, its title and its kind. */
export const cardWords = (card: HomeCard): readonly string[] => [card.path, card.title, card.kind]

/**
 * Entries that match every word of `query` somewhere in their `words`, ignoring case, in list order. An empty query
 * keeps the list itself (the same array).
 */
export function filterEntries<E>(
  entries: readonly E[],
  query: string,
  words: (entry: E) => readonly string[],
): readonly E[] {
  const wanted = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (wanted.length === 0) return entries
  return entries.filter((entry) => {
    const text = words(entry).join('\n').toLowerCase()
    return wanted.every((word) => text.includes(word))
  })
}

/** "4 in this workspace", or "2 of 4 shown" while a search narrows the list: the line beside the Projects title. */
export function projectCount(total: number, shown: number, query: string): string {
  if (total === 0) return 'No projects'
  return query.trim() === '' ? `${total} in this workspace` : `${shown} of ${total} shown`
}

// --- selection --------------------------------------------------------------------------------------------------

export type StepKey = 'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'ArrowDown' | 'Home' | 'End'

interface Pathed {
  readonly path: string
}

/** The selection kept if it is still shown; else the first entry; else nothing. */
export function reconcileSelection(
  visible: readonly Pathed[],
  selected: string | undefined,
): string | undefined {
  if (selected !== undefined && visible.some((entry) => entry.path === selected)) return selected
  return visible[0]?.path
}

/**
 * Where an arrow key or Home or End moves the selection. The list is one run in list order whatever the number of
 * columns, so left and up go back and right and down go forward; the ends do not wrap. With nothing selected, going
 * forward lands on the first entry and going back on the last.
 */
export function stepSelection(
  visible: readonly Pathed[],
  selected: string | undefined,
  key: StepKey,
): string | undefined {
  if (visible.length === 0) return undefined
  if (key === 'Home') return visible[0]?.path
  if (key === 'End') return visible.at(-1)?.path
  const forward = key === 'ArrowRight' || key === 'ArrowDown'
  const at = visible.findIndex((entry) => entry.path === selected)
  if (at === -1) return (forward ? visible[0] : visible.at(-1))?.path
  const next = Math.min(visible.length - 1, Math.max(0, at + (forward ? 1 : -1)))
  return visible[next]?.path
}

// --- words on a card --------------------------------------------------------------------------------------------

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

/**
 * "just now", "5 min ago", "2 h ago", "yesterday", then the date ("Oct 21", with the year when it is not this one).
 * Whole elapsed durations, so the first four do not depend on the time zone; the date reads in `timeZone` (the
 * device's own when omitted).
 */
export function modifiedLabel(mtime: number, now: number, timeZone?: string): string {
  const elapsed = now - mtime
  if (elapsed < MINUTE) return 'just now'
  if (elapsed < HOUR) return `${Math.floor(elapsed / MINUTE)} min ago`
  if (elapsed < DAY) return `${Math.floor(elapsed / HOUR)} h ago`
  if (elapsed < 2 * DAY) return 'yesterday'
  const sameYear =
    new Date(mtime).toLocaleDateString('en-US', { year: 'numeric', timeZone }) ===
    new Date(now).toLocaleDateString('en-US', { year: 'numeric', timeZone })
  return new Date(mtime).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
    timeZone,
  })
}

/** A path as its folder (with the slash) and its file name, so a narrow card can shorten the folder and keep the name. */
export function splitPath(path: string): { readonly dir: string; readonly name: string } {
  const at = path.lastIndexOf('/') + 1
  return { dir: path.slice(0, at), name: path.slice(at) }
}

/** "812 B", "4.2 KB", "16 MB": a decimal below ten, whole numbers above. */
export function sizeLabel(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const kilobytes = bytes / 1024
  if (kilobytes < 1024) return `${kilobytes < 10 ? kilobytes.toFixed(1) : Math.round(kilobytes)} KB`
  const megabytes = kilobytes / 1024
  return `${megabytes < 10 ? megabytes.toFixed(1) : Math.round(megabytes)} MB`
}

// --- storage ----------------------------------------------------------------------------------------------------

export interface StorageNote {
  readonly tone: 'ok' | 'warn' | 'info'
  readonly text: string
}

/** The lines under "Storage" in the sources panel. */
export function storageNotes(workspace: Workspace): readonly StorageNote[] {
  if (workspace.persistent) {
    return [
      { tone: 'ok', text: 'Autosave on' },
      {
        tone: 'ok',
        text: workspace.served ? 'Saved in your game folder' : 'Kept in this browser’s private storage',
      },
      { tone: 'info', text: 'Edits are autosaved beside your projects, so a crash does not lose them.' },
    ]
  }
  return [
    { tone: 'warn', text: 'Not saved on this device' },
    ...(workspace.reason === undefined ? [] : [{ tone: 'warn' as const, text: workspace.reason }]),
    { tone: 'info', text: 'Projects last until this tab closes. Export keeps your work.' },
  ]
}

/** "4 projects · browser storage" under the workspace row. */
export function workspaceSubtitle(workspace: Workspace, count: number): string {
  const projects = count === 0 ? 'No projects' : plural(count, 'project', 'projects')
  return `${projects} · ${workspace.served ? 'game checkout' : workspace.persistent ? 'browser storage' : 'this session only'}`
}
