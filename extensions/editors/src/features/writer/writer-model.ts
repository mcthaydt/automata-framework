// A scene's lines as a script: who says what, and in words what each line is for. The edits are the kit's content edits
// by key path, so the file keeps its comments and order. Writer never reorders a lines file; new lines go at the end.
import type { ContentEdit } from '@automata/editor/kit/documents'
import type { Canon, LineKind, LinesFile } from '@automata/narrative/sim'
import { appendEdits } from '../../shared/fields.ts'
import { humanize, KIND_WORDS } from './writer-words.ts'

export interface ScriptLine {
  readonly index: number
  readonly id: string
  /** Who says it, in words; empty when no one does. */
  readonly who: string
  /** What it says; `undefined` while no words are written. */
  readonly words: string | undefined
  /** What the line is for, in words. */
  readonly kind: string
}

type People = Canon['people']

const nameOf = (speaker: string, people: People | undefined): string =>
  people?.[speaker]?.name ?? humanize(speaker)

export function scriptLines(file: LinesFile, people: People | undefined): ScriptLine[] {
  return file.lines.map((line, index) => ({
    index,
    id: line.id,
    who: line.speaker === undefined ? '' : nameOf(line.speaker, people),
    words: line.words,
    kind: KIND_WORDS[line.kind],
  }))
}

/** Who can say a line here: the canon's people, then the speakers the scene already has. */
export function speakerChoices(
  people: People | undefined,
  file: LinesFile | undefined,
): { readonly value: string; readonly label: string }[] {
  const seen = new Set<string>()
  const out: { value: string; label: string }[] = []
  const add = (speaker: string): void => {
    if (seen.has(speaker)) return
    seen.add(speaker)
    out.push({ value: speaker, label: nameOf(speaker, people) })
  }
  for (const speaker of Object.keys(people ?? {})) add(speaker)
  for (const line of file?.lines ?? []) if (line.speaker !== undefined) add(line.speaker)
  return out
}

const MOST_AFTER_SCENE = 40
const FIRST_WORDS = 4

/** `shop.welcome_in_mind_the`: the scene, then the first words, lower case, unique among the scene's lines. */
export function newLineId(scene: string, words: string, taken: ReadonlySet<string>): string {
  const slug =
    words
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((part) => part !== '')
      .slice(0, FIRST_WORDS)
      .join('_')
      .slice(0, MOST_AFTER_SCENE) || 'line'
  const free = (name: string): string => `${scene}.${name}`
  if (!taken.has(free(slug))) return free(slug)
  for (let n = 2; ; n += 1) {
    const tail = `_${String(n)}`
    const candidate = free(`${slug.slice(0, MOST_AFTER_SCENE - tail.length)}${tail}`)
    if (!taken.has(candidate)) return candidate
  }
}

export interface NewLine {
  readonly id: string
  readonly kind: LineKind
  readonly speaker?: string | undefined
  readonly words: string
}

/** A new line at the end. Its `text` is its id: the key the sim holds, which no one types. */
export function addLineEdits(file: LinesFile | undefined, line: NewLine): ContentEdit[] {
  const row = {
    id: line.id,
    kind: line.kind,
    ...(line.speaker === undefined || line.speaker === '' ? {} : { speaker: line.speaker }),
    text: line.id,
    words: line.words,
  }
  return appendEdits(['lines'], file?.lines !== undefined, row)
}

/** The words changed; empty words are not words, so the key goes (`undefined` when there is nothing to change). */
export function wordsEdit(index: number, before: string | undefined, words: string): ContentEdit | undefined {
  const path = ['lines', index, 'words']
  if (words.trim() === '') return before === undefined ? undefined : { keyPath: path, remove: true }
  return before === undefined
    ? { keyPath: path, insert: words }
    : { keyPath: path, expected: before, set: words }
}

export const removeLineEdit = (index: number): ContentEdit => ({ keyPath: ['lines', index], remove: true })
