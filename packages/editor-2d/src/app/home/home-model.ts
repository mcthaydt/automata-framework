import type { HomeCard, ToastKind, Tone } from '@mcthaydt/automata-editor-kit/core'
import type { ProfileRegistry } from '../../profiles/profile'
import type { CopyOutcome, ImportOutcome, OpenOutcome } from '../editor-app'
import type { ProjectEntry } from '../project-list'

// What the 2D editor's Home decides before anything is drawn (plan ED2D.4c2a, decisions 3 to 8): how an entry reads on
// its card, the template cards and the message for each way an action can end. Plain functions of the list and the
// registry, so the components only show what they return and Node tests cover all of it. The search, the selection,
// the ages, sizes and storage notes are the kit's (`editor-kit/core`, moved there in ED3D.5c), shared with editor-3d.

const plural = (count: number, one: string, many: string): string => `${count} ${count === 1 ? one : many}`
const baseName = (path: string): string => path.slice(path.lastIndexOf('/') + 1)

// --- words on a card --------------------------------------------------------------------------------------------

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

/** The kit's card for an entry. An undecided file has no kind yet, so no accent: its tile and pill are neutral. */
export function homeCard(entry: ProjectEntry, registry: ProfileRegistry): HomeCard {
  return {
    path: entry.path,
    title: cardTitle(entry),
    badge: entryBadge(entry),
    kind: kindLabel(entry),
    accent: entry.status === 'ambiguous' ? undefined : kindTone(registry, entry.profile.id),
    size: entry.size,
    mtime: entry.mtime,
  }
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
      return `${name} could be ${labels.slice(0, -1).join(', ')} or ${labels.at(-1)}.`
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

export function removeMessage(path: string): Notice {
  return { kind: 'info', text: `Deleted ${baseName(path)}.` }
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
