// What the 3D editor's Home says (plan ED3D.5c, decisions 2 to 4): how a level reads on its card and in
// the summary, and the words of an open or an import. The list, the search, the selection and the drawing are the
// kit's (`createProjectBrowser`, `HomeScreen`); this file only knows the 3D editor's entries and outcomes.
import { cardWords, type HomeCard, type ToastKind } from '@automata/editor/kit/core'
import type { ImportOutcome } from '../document/import-files'
import type { ProjectEntry } from './project-list'

const plural = (count: number, one: string, many: string): string => `${count} ${count === 1 ? one : many}`
const baseName = (path: string): string => path.slice(path.lastIndexOf('/') + 1)

/** Accents for a level's profile, taken in turn by its place among the installed profiles (never by its name). */
const PROFILE_TOKENS: readonly string[] = [
  '--color-layer-tiles',
  '--color-layer-sky',
  '--color-layer-intgrid',
]

function accentOf(profile: string, installed: readonly string[]): string {
  const at = installed.indexOf(profile)
  return at === -1 ? '--color-text-dim' : (PROFILE_TOKENS[at % PROFILE_TOKENS.length] ?? '--color-text-dim')
}

function badgeOf(entry: ProjectEntry): HomeCard['badge'] {
  if (entry.status === 'broken') return { tone: 'bad', text: 'Can’t open' }
  const errors = plural(entry.errors, 'error', 'errors')
  const warnings = plural(entry.warnings, 'warning', 'warnings')
  if (entry.errors > 0) return { tone: 'bad', text: entry.warnings > 0 ? `${errors} · ${warnings}` : errors }
  if (entry.warnings > 0) return { tone: 'warn', text: warnings }
  return { tone: 'ok', text: 'Valid' }
}

/** The kit's card for an entry: a level by its file and its profile's id (the name every message uses). */
export function levelCard(entry: ProjectEntry, installed: readonly string[]): HomeCard {
  return {
    path: entry.path,
    title: baseName(entry.path),
    badge: badgeOf(entry),
    kind: entry.profile,
    accent: accentOf(entry.profile, installed),
    size: entry.size,
    mtime: entry.mtime,
  }
}

/** What a search looks through for an entry: the same words as its card. */
export const searchWords = (entry: ProjectEntry): readonly string[] => cardWords(levelCard(entry, []))

export interface Summary {
  readonly facts: readonly { readonly label: string; readonly value: string }[]
  /** Why the file does not open plainly: its first problem. A broken level still opens, into the error panel with every problem. */
  readonly reason: string | undefined
}

/** The inspector's facts and reason for the selected entry. */
export function summaryOf(entry: ProjectEntry): Summary {
  if (entry.status === 'broken')
    return { facts: [{ label: 'Profile', value: entry.profile }], reason: entry.message }
  return {
    facts: [
      { label: 'Profile', value: entry.profile },
      { label: 'Errors', value: String(entry.errors) },
      { label: 'Warnings', value: String(entry.warnings) },
    ],
    reason: undefined,
  }
}

/** The toast of an open that has nothing to look at: the file went, or the store refused. */
export function openProblem(
  outcome:
    | { readonly status: 'missing'; readonly path: string }
    | { readonly status: 'storageFailed'; readonly path: string; readonly message: string },
): string {
  const name = baseName(outcome.path)
  return outcome.status === 'missing'
    ? `${name} is no longer in this workspace.`
    : `${name}: ${outcome.message}`
}

export interface Notice {
  readonly kind: ToastKind
  readonly text: string
}

/** The toast of an import: what went where and what was left out, or why it stopped. */
export function importNotice(outcome: ImportOutcome): Notice {
  switch (outcome.status) {
    case 'imported': {
      const kept = `Imported ${plural(outcome.files.length, 'file', 'files')} into ${outcome.root}`
      if (outcome.skipped.length === 0) return { kind: 'ok', text: `${kept}.` }
      return {
        kind: 'warn',
        text: `${kept}; ${outcome.skipped.length} left out (system files, unsafe names or over 16 MB).`,
      }
    }
    case 'refused':
      return { kind: 'error', text: outcome.message }
    case 'failed':
      return {
        kind: 'error',
        text: `The import into ${outcome.root} stopped after ${plural(outcome.written.length, 'file', 'files')}: ${outcome.message}`,
      }
  }
}
