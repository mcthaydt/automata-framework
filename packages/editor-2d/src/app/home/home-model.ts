import type { ToastKind } from '@mcthaydt/automata-editor-kit'
import type { Workspace } from '@mcthaydt/automata-editor-kit/core'
import type { ProfileRegistry } from '../../profiles/profile'
import type { CopyOutcome, ImportOutcome, OpenOutcome } from '../editor-app'
import type { ProjectEntry } from '../project-list'

// What Home decides before anything is drawn (plan ED2D.4c2a, decisions 3 to 8): searching, the selection and how it
// moves, the words on a card, the template cards, the storage notes and the message for each way an action can end.
// Plain functions of the list, the registry and the workspace, so the components only show what they return and Node
// tests cover all of it.

const plural = (count: number, one: string, many: string): string => `${count} ${count === 1 ? one : many}`
const baseName = (path: string): string => path.slice(path.lastIndexOf('/') + 1)

// --- search -----------------------------------------------------------------------------------------------------

/** What a search looks through for an entry: its path, its own title and the labels of its profile or candidates. */
function haystack(entry: ProjectEntry): string {
  const words = [entry.path]
  if (entry.status === 'ambiguous') words.push(...entry.candidates.map((candidate) => candidate.label))
  else words.push(entry.profile.label)
  if (entry.status === 'ok' && entry.summary !== undefined) words.push(entry.summary.title)
  return words.join('\n').toLowerCase()
}

/** Entries that match every word of `query`, in list order. An empty query keeps the list itself. */
export function filterProjects(entries: readonly ProjectEntry[], query: string): readonly ProjectEntry[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (words.length === 0) return entries
  return entries.filter((entry) => {
    const text = haystack(entry)
    return words.every((word) => text.includes(word))
  })
}

// --- selection --------------------------------------------------------------------------------------------------

export type StepKey = 'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'ArrowDown' | 'Home' | 'End'

/** The selection kept if it is still shown; else the first entry; else nothing. */
export function reconcileSelection(
  visible: readonly ProjectEntry[],
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
  visible: readonly ProjectEntry[],
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

export type Tone = 'ok' | 'warn' | 'bad' | 'neutral'

/** The pill on a card and on the summary: what the project's checks found, or why it cannot be opened plainly. */
export function entryBadge(entry: ProjectEntry): { readonly tone: Tone; readonly text: string } {
  if (entry.status === 'broken') return { tone: 'bad', text: 'Can’t open' }
  if (entry.status === 'ambiguous') return { tone: 'neutral', text: 'Choose a profile' }
  const errors = plural(entry.errors, 'error', 'errors')
  const warnings = plural(entry.warnings, 'warning', 'warnings')
  if (entry.errors > 0) return { tone: 'bad', text: entry.warnings > 0 ? `${errors} · ${warnings}` : errors }
  if (entry.warnings > 0) return { tone: 'warn', text: warnings }
  return { tone: 'ok', text: 'Valid' }
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
      { tone: 'ok', text: 'Kept in this browser’s private storage' },
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
  return `${projects} · ${workspace.persistent ? 'browser storage' : 'this session only'}`
}

// --- how an action ended ----------------------------------------------------------------------------------------

const MEGABYTE = 1024 * 1024

/** One line for every way an open or create can end without a document: what a toast says. */
export function openProblem(outcome: Exclude<OpenOutcome, { readonly status: 'opened' }>): string {
  const name = baseName(outcome.path)
  switch (outcome.status) {
    case 'unrecognised':
      return `${name} is not a project this editor opens.`
    case 'notText':
      return `${name} is not a text file.`
    case 'missing':
      return `${name} is no longer in this workspace.`
    case 'tooLarge':
      return `${name} is ${Math.round(outcome.bytes / MEGABYTE)} MB; the limit is 16 MB.`
    case 'invalid': {
      const first = outcome.errors[0]
      if (first === undefined) return `${name} does not open.`
      const where =
        first.line === undefined
          ? ''
          : ` (line ${first.line}${first.column === undefined ? '' : `, column ${first.column}`})`
      return `${name} does not open: ${first.message.replace(/\.$/, '')}${where}.`
    }
    case 'choose': {
      // A choice is only ever offered between two or more profiles.
      const labels = outcome.candidates.map((candidate) => `a ${candidate.label}`)
      return `${name} could be ${labels.slice(0, -1).join(', ')} or ${labels.at(-1)}. Choosing between them is not available yet.`
    }
    case 'storageFailed':
      return `${name}: ${outcome.message}`
  }
}

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
