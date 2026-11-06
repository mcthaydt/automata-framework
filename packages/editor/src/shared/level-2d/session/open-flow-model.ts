import type { ParseError, Profile } from '../profiles/profile'
import type { OpenOutcome } from './editor-app-types'

// What the open flows decide before anything is drawn (plan ED2D.4c2b, decisions 1 to 3, 5 and 6): which outcome of
// opening a file gets the error panel, what the panel says and which lines of the file it shows, and the words of the
// recovery and save flows. The panel never reads an error's code: a newer file or unknown keys are worded by the
// profile that refused them, so the app stays profile-blind (G-s).

/** The outcomes a person has to look at: the error panel, with the file's text when there is one. */
export type PanelOutcome =
  | Extract<OpenOutcome, { readonly status: 'invalid' | 'unrecognised' | 'tooLarge' }>
  // `OpenOutcome` words `notText` and `missing` as one member; only `notText` is the panel's.
  | { readonly status: 'notText'; readonly path: string }
/** Two or more profiles claim the file: the person picks one. */
export type ChoiceOutcome = Extract<OpenOutcome, { readonly status: 'choose' }>

const MEGABYTE = 1024 * 1024
/** The editor's file limit (spec §13), as the panel words it. */
const LIMIT_MB = 16
/** How many lines the text view draws at most: enough to read around an error, few enough for a tablet. */
const WINDOW_LINES = 400

const baseName = (path: string): string => path.slice(path.lastIndexOf('/') + 1)

export function needsPanel(outcome: OpenOutcome): outcome is PanelOutcome {
  return (
    outcome.status === 'invalid' ||
    outcome.status === 'unrecognised' ||
    outcome.status === 'notText' ||
    outcome.status === 'tooLarge'
  )
}

export interface PanelProblem {
  readonly text: string
  /** `line 3, column 14`, `line 3`, a key path, or nothing when the profile does not know where. */
  readonly where: string | undefined
}

export interface ErrorPanelModel {
  readonly title: string
  readonly problems: readonly PanelProblem[]
  /** The file's text for the read-only view; absent when it is not text or too large to read. */
  readonly text: string | undefined
  /** The lines (from 1) an error points at, sorted, each once. */
  readonly lines: readonly number[]
}

function where(error: ParseError): string | undefined {
  if (error.line !== undefined)
    return error.column === undefined ? `line ${error.line}` : `line ${error.line}, column ${error.column}`
  return error.path
}

const only = (text: string): readonly PanelProblem[] => [{ text, where: undefined }]

export function errorPanel(outcome: PanelOutcome): ErrorPanelModel {
  const name = baseName(outcome.path)
  switch (outcome.status) {
    case 'invalid': {
      const lines = [
        ...new Set(outcome.errors.flatMap((error) => (error.line === undefined ? [] : [error.line]))),
      ]
      return {
        title: `${name} does not open`,
        problems: outcome.errors.map((error) => ({ text: error.message, where: where(error) })),
        text: outcome.text,
        lines: lines.sort((a, b) => a - b),
      }
    }
    case 'unrecognised':
      return {
        title: `${name} is not a project this editor opens`,
        problems: only('None of the kinds of file this editor opens matches its name or its contents.'),
        text: outcome.text,
        lines: [],
      }
    case 'notText':
      return {
        title: `${name} is not a text file`,
        problems: only('Its bytes are not UTF-8 text.'),
        text: undefined,
        lines: [],
      }
    case 'tooLarge':
      return {
        title: `${name} is too large to open`,
        problems: only(
          `It is ${Math.round(outcome.bytes / MEGABYTE)} MB; the editor opens files up to ${LIMIT_MB} MB.`,
        ),
        text: undefined,
        lines: [],
      }
  }
}

export interface TextWindow {
  /** The number of the first line drawn, from 1. */
  readonly first: number
  readonly lines: readonly string[]
  readonly total: number
}

/**
 * The lines of `text` the read-only view draws: all of a short file; of a long one, the first `size` lines, or the
 * `size` lines centred on `focus` (the first error's line) when it lies beyond them. A final newline ends the last
 * line rather than starting one more.
 */
export function textWindow(text: string, focus?: number, size: number = WINDOW_LINES): TextWindow {
  const all = text.split(/\r?\n/)
  if (all.at(-1) === '') all.pop()
  const total = all.length
  let first = 1
  if (focus !== undefined && focus > size)
    first = Math.max(1, Math.min(focus - Math.floor(size / 2), total - size + 1))
  return { first, lines: all.slice(first - 1, first - 1 + size), total }
}

/** The top bar's heading: the profile's own title for the document, else its file name, over its path. */
export function documentHeading(
  profile: Profile<unknown>,
  value: unknown,
  path: string,
): { readonly title: string; readonly file: string } {
  return { title: profile.summary?.(value).title ?? baseName(path), file: path }
}

export function restoreRefused(errors: readonly ParseError[]): string {
  const first = errors[0]
  const why = first === undefined ? '' : ` (${first.message})`
  return `The autosave no longer opens${why}. Discard it to go on with the file as it was last saved.`
}
