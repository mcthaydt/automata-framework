import type { StageDocument } from './stage-document'
import {
  citySinkTable,
  courseTables,
  elementTable,
  type ListName,
  presentationTables,
  RANK,
} from './stage-tables'
import { type Block, scanBlocks } from './toml-blocks'
import { appendTable, insertAfter, insertBefore, removeTable, tableLines } from './toml-edit'

// The block engine's part of printing a stage (EDFF.1a decisions 2, 8 and 9). `reconcileTables` turns the lines of the
// text a document was read from into lines that have the document's tables: it adds, removes and moves whole tables
// with their comments, and leaves every value inside a table to the kit's `patchToml` (EDS.1a), which writes a changed
// value in its literal's span and the rest through `toml-patch`.

type Lines = readonly string[]

const COURSE_TABLES = ['course', 'course.phrases', 'course.extension'] as const
const PRESENTATION_TABLES = ['theme.presentation', 'theme.presentation.citySink'] as const

const blocksNamed = (lines: Lines, name: string): Block[] =>
  scanBlocks(lines).filter((block) => block.name === name)

/** Tables written one after the other, separated by a blank line. */
const joinTables = (tables: readonly (readonly string[])[]): string[] =>
  tables.flatMap((table, index) => (index === 0 ? table : ['', ...table]))

/** Removes every table called one of `names`, last first so the numbers of the others stay right. */
function removeNamed(lines: Lines, names: readonly string[]): Lines {
  const doomed = scanBlocks(lines)
    .filter((block) => names.includes(block.name))
    .sort((a, b) => b.start - a.start)
  return doomed.reduce<Lines>((current, block) => removeTable(current, block), lines)
}

/**
 * Puts `table` where the file's order says: after the last table that comes before it, otherwise before the first that
 * comes after it, otherwise at the end.
 */
function placeByRank(lines: Lines, name: string, table: readonly string[]): Lines {
  const rank = RANK[name] as number
  const blocks = scanBlocks(lines)
  const previous = blocks.filter((block) => (RANK[block.name] ?? Number.POSITIVE_INFINITY) < rank).at(-1)
  if (previous !== undefined) return insertAfter(lines, previous, table)
  const next = blocks.find((block) => (RANK[block.name] ?? Number.NEGATIVE_INFINITY) > rank)
  if (next !== undefined) return insertBefore(lines, next, table)
  return appendTable(lines, table)
}

/** Puts an element of a list at `index` among the list's tables. */
function placeElement(lines: Lines, list: ListName, index: number, table: readonly string[]): Lines {
  const blocks = blocksNamed(lines, list)
  const next = blocks[index]
  if (next !== undefined) return insertBefore(lines, next, table)
  const last = blocks.at(-1)
  if (last !== undefined) return insertAfter(lines, last, table)
  return placeByRank(lines, list, table)
}

/**
 * Makes the tables of `list` those of `next`, in three passes over the ids: the elements the document dropped go; the
 * kept ones are rearranged by writing each into the place of the table that held the one now in that position, so the
 * text between tables (a paragraph about what follows) stays where it was; the new ones are written at their
 * positions. A list the text does not write as tables (an inline array) is left to `toml-patch`.
 */
function reconcileList(
  lines: Lines,
  list: ListName,
  baseIds: readonly string[],
  nextIds: readonly string[],
  nextElements: readonly unknown[],
): Lines {
  if (blocksNamed(lines, list).length !== baseIds.length) return lines
  const kept = new Set(nextIds)
  let current = lines
  for (let i = baseIds.length - 1; i >= 0; i--) {
    const block = blocksNamed(current, list)[i]
    if (block !== undefined && !kept.has(baseIds[i] as string)) current = removeTable(current, block)
  }

  const known = new Set(baseIds)
  const before = baseIds.filter((id) => kept.has(id))
  const after = nextIds.filter((id) => known.has(id))
  const blocks = blocksNamed(current, list)
  const tables = new Map(before.map((id, i) => [id, tableLines(current, blocks[i] as Block)]))
  for (let i = blocks.length - 1; i >= 0; i--) {
    const block = blocks[i] as Block
    current = [
      ...current.slice(0, block.start),
      ...(tables.get(after[i] as string) ?? []),
      ...current.slice(block.last + 1),
    ]
  }

  nextIds.forEach((id, i) => {
    if (!known.has(id)) current = placeElement(current, list, i, elementTable(list, nextElements[i] as never))
  })
  return current
}

function assertListIds(ids: readonly string[], elements: number, list: string): void {
  if (ids.length !== elements) throw new Error(`${list} has ${elements} elements and ${ids.length} ids`)
  if (new Set(ids).size !== ids.length) throw new Error(`${list} has an id twice`)
}

/** The lines of the text `base` was read from, changed to have the tables of `next`. */
export function reconcileTables(lines: Lines, base: StageDocument, next: StageDocument): Lines {
  const baseValue = base.value
  const nextValue = next.value
  assertListIds(next.ids.extension, nextValue.course?.extension?.length ?? 0, 'course.extension')
  assertListIds(next.ids.layers, nextValue.theme.layers.length, 'theme.layers')
  assertListIds(next.ids.setPieces, nextValue.theme.setPieces.length, 'theme.setPieces')

  let current = lines
  if (baseValue.course !== undefined && nextValue.course === undefined)
    current = removeNamed(current, COURSE_TABLES)
  else if (baseValue.course === undefined && nextValue.course !== undefined)
    current = placeByRank(current, 'course', joinTables(courseTables(nextValue.course)))

  const basePresentation = baseValue.theme.presentation
  const nextPresentation = nextValue.theme.presentation
  if (basePresentation !== undefined && nextPresentation === undefined)
    current = removeNamed(current, PRESENTATION_TABLES)
  else if (basePresentation === undefined && nextPresentation !== undefined)
    current = placeByRank(current, 'theme.presentation', joinTables(presentationTables(nextPresentation)))
  else if (basePresentation !== undefined && nextPresentation !== undefined) {
    if (basePresentation.citySink !== undefined && nextPresentation.citySink === undefined)
      current = removeNamed(current, ['theme.presentation.citySink'])
    else if (basePresentation.citySink === undefined && nextPresentation.citySink !== undefined)
      current = placeByRank(current, 'theme.presentation.citySink', citySinkTable(nextPresentation.citySink))
  }

  if (baseValue.course !== undefined && nextValue.course !== undefined)
    current = reconcileList(
      current,
      'course.extension',
      base.ids.extension,
      next.ids.extension,
      nextValue.course.extension ?? [],
    )
  current = reconcileList(current, 'theme.layers', base.ids.layers, next.ids.layers, nextValue.theme.layers)
  return reconcileList(
    current,
    'theme.setPieces',
    base.ids.setPieces,
    next.ids.setPieces,
    nextValue.theme.setPieces,
  )
}
