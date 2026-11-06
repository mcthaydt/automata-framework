// What the 3D editor's open and save flows say (plan ED3D.5c, decisions 5 and 6; ED3D spec §11): which outcomes of an
// open a person has to look at in the error panel and what it lists, the held Save of a refused patch (ED3-o), and the
// toasts that are this editor's own (the kit's `document-messages` has the rest). Plain functions, so Node tests cover
// the words and the components only show them.
import type { JsonPath } from '@mcthaydt/automata-editor/kit/documents'
import type { ParseIssue } from '../../profile/file-codec'
import type { OpenOutcome } from '../editor-app'
import type { PatchRefused } from '../patched-document'

/** The outcomes of an open that show the error panel: something is wrong with the file itself. */
export type PanelOutcome =
  | Extract<OpenOutcome, { readonly status: 'invalid' | 'unrecognised' | 'tooLarge' }>
  // The app gives `notText` and `missing` one shape; only `notText` is the panel's.
  | { readonly status: 'notText'; readonly path: string }

export function needsPanel(outcome: OpenOutcome): outcome is PanelOutcome {
  return (
    outcome.status === 'invalid' ||
    outcome.status === 'unrecognised' ||
    outcome.status === 'notText' ||
    outcome.status === 'tooLarge'
  )
}

const baseName = (path: string): string => path.slice(path.lastIndexOf('/') + 1)
const MEGABYTE = 1024 * 1024

/** A JSON path as a person reads it: `sectors.0.floor`, and the file itself for the root. */
export function jsonPathLabel(path: JsonPath): string {
  return path.length === 0 ? '(file)' : path.join('.')
}

/** "a", "a and b", "a, b and c". */
function listOf(names: readonly string[]): string {
  return names.length < 2 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`
}

export interface ErrorPanelModel {
  readonly title: string
  /** One row per problem: where in the file (a JSON path) and what is wrong there. */
  readonly rows: readonly { readonly path: string; readonly message: string }[]
  /** Which profile read it and which ones this editor has. */
  readonly note: string | undefined
  /** Everything above as plain text, for Copy details. */
  readonly details: string
}

/** The error panel of a file that does not open (ED3D spec §11): its JSON paths and messages, and Copy details. */
export function errorPanel(outcome: PanelOutcome): ErrorPanelModel {
  const name = baseName(outcome.path)
  const issueRows = (issues: readonly ParseIssue[]) =>
    issues.map((issue) => ({ path: jsonPathLabel(issue.path), message: issue.message }))
  const opens = (installed: readonly string[]): string => `This editor opens ${listOf(installed)}.`
  const detailsOf = (
    head: readonly string[],
    rows: ErrorPanelModel['rows'],
    tail: readonly string[],
  ): string => [...head, ...rows.map((row) => `${row.path}: ${row.message}`), ...tail].join('\n')
  switch (outcome.status) {
    case 'invalid': {
      const rows = issueRows(outcome.issues)
      return {
        title: `${name} does not open`,
        rows,
        note: `Read as ${outcome.profile.id}. ${opens(outcome.installed)}`,
        details: detailsOf([`${outcome.path} does not open`, `Profile: ${outcome.profile.id}`], rows, [
          `Installed profiles: ${outcome.installed.join(', ')}`,
        ]),
      }
    }
    case 'unrecognised': {
      const rows = [{ path: jsonPathLabel([]), message: outcome.reason }]
      return {
        title: `${name} is not a level this editor opens`,
        rows,
        note: opens(outcome.installed),
        details: detailsOf([`${outcome.path} is not a level this editor opens`], rows, [
          `Installed profiles: ${outcome.installed.join(', ')}`,
        ]),
      }
    }
    case 'notText':
      return {
        title: `${name} is not a text file`,
        rows: [],
        note: undefined,
        details: `${outcome.path} is not a text file`,
      }
    case 'tooLarge': {
      const rows = [
        {
          path: jsonPathLabel([]),
          message: `It is ${Math.round(outcome.bytes / MEGABYTE)} MB; the limit is 16 MB.`,
        },
      ]
      return {
        title: `${name} is too large to open`,
        rows,
        note: undefined,
        details: detailsOf([`${outcome.path} is too large to open`], rows, []),
      }
    }
  }
}

/** What the held Save dialog says (ED3-o): the path the codec cannot keep, its reason and the two ways on. */
export function heldSave(
  file: string,
  refused: PatchRefused,
): { readonly title: string; readonly path: string; readonly reason: string; readonly message: string } {
  return {
    title: `${baseName(file)} can’t be saved as it is written`,
    path: jsonPathLabel(refused.path),
    reason: refused.detail,
    message:
      'The editor keeps a file’s layout by changing only what you edited, and it cannot write this change that way. Nothing was written. Save reformatted rewrites the whole file in the editor’s layout; Export a copy downloads it and leaves the file alone.',
  }
}

/** The top bar's heading: the level's file name over its path. */
export function documentHeading(path: string): { readonly title: string; readonly file: string } {
  return { title: baseName(path), file: path }
}

export function restoreRefused(issues: readonly ParseIssue[]): string {
  const first = issues[0]
  const why = first === undefined ? '' : ` (${jsonPathLabel(first.path)}: ${first.message})`
  return `The autosave no longer opens${why}. Discard it to go on with the file as it was last saved.`
}

export function reformattedMessage(path: string): string {
  return `Saved ${baseName(path)} reformatted.`
}

export function exportedMessage(name: string): string {
  return `Exported a copy as ${name}.`
}
