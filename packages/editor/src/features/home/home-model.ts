import { type HomeCard, modifiedLabel, type Tone } from '../../shared/kit/home/project-browse.ts'
import { baseName } from '../../shared/kit/storage/store-path.ts'
import type { Workspace } from '../../shared/kit/storage/workspace.ts'
import type { ToastKind } from '../../shared/kit/widgets/toasts.ts'
import type { LevelThumbnails } from '../../shared/level-2d/canvas/level-thumbnails'
import type { CopyOutcome, ImportOutcome } from '../../shared/level-2d/documents/editor-app'
import type { ProjectEntry } from '../../shared/level-2d/documents/project-list'
import type { ProfileRegistry } from '../../shared/level-2d/profiles/profile'

// What the 2D editor's Home decides before anything is drawn: how an entry reads on
// its card, the template cards and the message for each way an action can end. Plain functions of the list and the
// registry, so the components only show what they return and Node tests cover all of it. The search, the selection,
// the ages, sizes and storage notes are the kit's (`shared/kit/home`), shared with editor-3d.

const plural = (count: number, one: string, many: string): string => `${count} ${count === 1 ? one : many}`

// --- words on a card --------------------------------------------------------------------------------------------

/**
 * The pill on a card and on the summary: how many problems the level's checks found (errors and warnings are one
 * count, red when any is an error), or why it cannot be opened plainly. A level with nothing wrong has no pill: every
 * card is a level, so a "Valid" on each would say nothing.
 */
export function entryBadge(entry: ProjectEntry): { readonly tone: Tone; readonly text: string } | undefined {
  if (entry.status === 'broken') return { tone: 'bad', text: 'Can’t open' }
  if (entry.status === 'ambiguous') return { tone: 'neutral', text: 'Choose a profile' }
  const problems = entry.errors + entry.warnings
  if (problems === 0) return undefined
  return { tone: entry.errors > 0 ? 'bad' : 'warn', text: plural(problems, 'problem', 'problems') }
}

/** Accents for the kind of a project, taken in turn by the profile's place in the registry (never by its name). */
const KIND_TOKENS: readonly string[] = [
  '--color-layer-tiles',
  '--color-layer-sky',
  '--color-layer-city',
  '--color-layer-intgrid',
]

/** The CSS variable of a profile's accent; the neutral one for a profile the registry does not hold. */
export function kindTone(registry: ProfileRegistry, profileId: string): string {
  const at = registry.list().findIndex((profile) => profile.id === profileId)
  return at === -1 ? '--color-text-dim' : (KIND_TOKENS[at % KIND_TOKENS.length] ?? '--color-text-dim')
}

/** What a card and the summary call a project: the profile's own title for it, else its file's name. */
export function cardTitle(entry: ProjectEntry): string {
  return entry.status === 'ok' && entry.summary !== undefined ? entry.summary.title : baseName(entry.path)
}

/** What kind a card says the project is: its profile's label, or the labels of the profiles that claim it. */
function kindLabel(entry: ProjectEntry): string {
  return entry.status === 'ambiguous'
    ? entry.candidates.map((candidate) => candidate.label).join(' or ')
    : entry.profile.label
}

/** What a search looks through for an entry: its path, its own title and the labels of its profile or candidates. */
export function searchWords(entry: ProjectEntry): readonly string[] {
  return [entry.path, cardTitle(entry), kindLabel(entry)]
}

/**
 * The kit's card for an entry. An undecided file has no kind yet, so no accent: its tile and pill are neutral. With
 * `thumbnails`, an entry whose profile names a level to preview draws it in the tile; the key changes with
 * the file (path, size, time) and with its images, so the tile redraws after either changes.
 */
export function homeCard(
  entry: ProjectEntry,
  registry: ProfileRegistry,
  thumbnails?: LevelThumbnails,
): HomeCard {
  const preview = entry.status === 'ok' ? entry.preview : undefined
  const key = `${entry.path}|${entry.size}|${entry.mtime}|${preview?.images}`
  return {
    path: entry.path,
    title: cardTitle(entry),
    badge: entryBadge(entry),
    kind: kindLabel(entry),
    accent: entry.status === 'ambiguous' ? undefined : kindTone(registry, entry.profile.id),
    size: entry.size,
    mtime: entry.mtime,
    preview:
      thumbnails === undefined || preview === undefined
        ? undefined
        : { key, draw: () => thumbnails.thumbnail(key, preview) },
  }
}

// --- where levels live -------------------------------------------------------------------------------------------

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

/**
 * When a file changed, in whole words: "just now", "7 minutes ago", "3 hours ago", then "yesterday" and the date in
 * `timeZone` (the kit's `modifiedLabel` writes those, so both editors date a file alike). Never "min" or "h".
 */
export function whenLabel(mtime: number, now: number, timeZone?: string): string {
  const elapsed = now - mtime
  if (elapsed < MINUTE) return 'just now'
  if (elapsed < HOUR) return `${plural(Math.floor(elapsed / MINUTE), 'minute', 'minutes')} ago`
  if (elapsed < DAY) return `${plural(Math.floor(elapsed / HOUR), 'hour', 'hours')} ago`
  return modifiedLabel(mtime, now, timeZone)
}

/** "Changed 7 minutes ago": the one fact a card gives besides the level's name. */
export const changedLabel = (mtime: number, now: number, timeZone?: string): string =>
  `Changed ${whenLabel(mtime, now, timeZone)}`

/** Where the levels on Home come from, as the "Open from" control names it: the game by its name, else the browser. */
export function sourceLabel(workspace: Workspace): string {
  if (workspace.served === true)
    return workspace.game === undefined ? 'Your game' : `Your game: ${workspace.game}`
  return workspace.persistent ? 'This browser' : 'This tab only'
}

/**
 * The one line under the list that says how work is kept. The autosave is a safety net, so it is told as what it
 * does for her ("kept if the page closes"), never by name; the browser's technical reason for no storage is not hers.
 */
export function storageLine(workspace: Workspace): string {
  if (!workspace.persistent) return 'Not saved on this device. Download your level to keep it.'
  const where = workspace.served === true ? 'in your game folder' : 'in this browser'
  return `Saved ${where}. Edits are kept if the page closes.`
}

// --- templates --------------------------------------------------------------------------------------------------

export interface TemplateCard {
  /** Unique across profiles: `profileId/templateId`. */
  readonly key: string
  readonly profileId: string
  readonly profileLabel: string
  readonly id: string
  readonly label: string
  readonly hint: string | undefined
  /** Whether the card names its profile: only when there is more than one to tell apart. */
  readonly tagged: boolean
}

/** Every template of every registered profile, profiles in registration order. */
export function templateCards(registry: ProfileRegistry): readonly TemplateCard[] {
  const profiles = registry.list()
  const tagged = profiles.length > 1
  return profiles.flatMap((profile) =>
    profile.templates.map((template) => ({
      key: `${profile.id}/${template.id}`,
      profileId: profile.id,
      profileLabel: profile.label,
      id: template.id,
      label: template.label,
      hint: template.hint,
      tagged,
    })),
  )
}

// --- how an action ended ----------------------------------------------------------------------------------------

export interface Notice {
  readonly kind: ToastKind
  readonly text: string
}

export function duplicateMessage(path: string, outcome: CopyOutcome): Notice {
  switch (outcome.status) {
    case 'copied':
      return { kind: 'ok', text: `Copied to ${baseName(outcome.path)}.` }
    case 'missing':
      return { kind: 'error', text: `${baseName(path)} is no longer in this workspace.` }
    case 'failed':
      return { kind: 'error', text: `Could not copy ${baseName(path)}: ${outcome.message}` }
  }
}

export function importMessage(outcome: ImportOutcome): Notice {
  switch (outcome.status) {
    case 'imported':
      return {
        kind: 'ok',
        text:
          outcome.path === outcome.name
            ? `Imported ${outcome.name}.`
            : `Imported ${outcome.name} as ${outcome.path}.`,
      }
    case 'refused':
      return { kind: 'error', text: refusal(outcome.name, outcome.reason) }
    case 'failed':
      return { kind: 'error', text: `Could not import ${outcome.name}: ${outcome.message}` }
  }
}

function refusal(name: string, reason: 'unrecognised' | 'notText' | 'tooLarge'): string {
  switch (reason) {
    case 'unrecognised':
      return `${name} is not a project this editor opens.`
    case 'notText':
      return `${name} is not a text file.`
    case 'tooLarge':
      return `${name} is over the 16 MB limit.`
  }
}

/** Said after a delete, naming the level as its card did (`cardTitle`), never its file. */
export function removeMessage(name: string): Notice {
  return { kind: 'info', text: `Deleted ${name}.` }
}

/** The toasts for a batch of imports: the files kept as one line (named when it is one), then a line for each that was not. */
export function importNotices(outcomes: readonly ImportOutcome[]): readonly Notice[] {
  const kept = outcomes.filter((outcome) => outcome.status === 'imported')
  const problems = outcomes.filter((outcome) => outcome.status !== 'imported').map(importMessage)
  const [only] = kept
  const summary: Notice[] =
    kept.length === 0
      ? []
      : only !== undefined && kept.length === 1
        ? [importMessage(only)]
        : [{ kind: 'ok', text: `Imported ${kept.length} files.` }]
  return [...summary, ...problems]
}
