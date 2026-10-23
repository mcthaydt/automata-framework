import { parseStage } from '../stage-codec'
import type { StageDocument } from '../stage-document'
import type { ListName } from '../stage-tables'

// Shared by the codec tests: the smallest stage the schema accepts, and helpers to read and edit a document.

/** The smallest stage the schema accepts, written the way the shipped stages are. */
export const MINIMAL_STAGE: string = [
  'id = "tiny"',
  'displayName = "Tiny"',
  'platformAlias = "world.platform"',
  '',
  '[courseTuning]',
  '',
  '[theme]',
  'backdropAlias = "world.sky"',
  '',
  '[[theme.layers]]',
  'alias = "world.sky"',
  'plate = "sky"',
  'depth = 0.1',
  'sink = 0',
  'extend = "plate"',
  '',
].join('\n')

/** The document of a text that parses; throws with the errors when it does not. */
export function documentOf(text: string): StageDocument {
  const result = parseStage(text)
  if (!result.ok) throw new Error(`expected the text to parse: ${JSON.stringify(result.error)}`)
  return result.value
}

export type Path = readonly (string | number)[]

/** The parent of the last step of `path` in a copy of the document's value, for `setAt` and `removeAt`. */
function editedCopy(
  document: StageDocument,
  path: Path,
): { copy: StageDocument; parent: Record<string, unknown>; key: string } {
  const value = structuredClone(document.value) as unknown as Record<string, unknown>
  let parent = value
  for (const step of path.slice(0, -1)) parent = parent[step as string] as Record<string, unknown>
  return {
    copy: { ...document, value: value as unknown as StageDocument['value'] },
    parent,
    key: String(path.at(-1)),
  }
}

/** A copy of the document with the value at `path` replaced; `undefined` leaves the key present and unset. */
export function setAt(document: StageDocument, path: Path, value: unknown): StageDocument {
  const { copy, parent, key } = editedCopy(document, path)
  parent[key] = value
  return copy
}

/** A copy of the document without the key at `path`. */
export function removeAt(document: StageDocument, path: Path): StageDocument {
  const { copy, parent, key } = editedCopy(document, path)
  delete parent[key]
  return copy
}

// -- lists -------------------------------------------------------------------------------------------------------

const LIST_IDS = {
  'course.extension': 'extension',
  'theme.layers': 'layers',
  'theme.setPieces': 'setPieces',
} as const

/** The elements of a list in the value, and the ids of them. */
export function listOf(document: StageDocument, list: ListName): { items: unknown[]; ids: string[] } {
  const value = document.value as unknown as {
    course?: { extension?: unknown[] }
    theme: Record<string, unknown[]>
  }
  const items =
    list === 'course.extension'
      ? (value.course?.extension ?? [])
      : (value.theme[list.slice('theme.'.length)] ?? [])
  return { items: [...items], ids: [...document.ids[LIST_IDS[list]]] }
}

/** A copy of the document whose list has these elements and ids; `course.extension` is left unset when it is empty. */
export function withList(
  document: StageDocument,
  list: ListName,
  items: unknown[],
  ids: string[],
): StageDocument {
  const value = structuredClone(document.value) as unknown as {
    course?: { extension?: unknown[] }
    theme: Record<string, unknown>
  }
  if (list === 'course.extension') {
    if (value.course === undefined) throw new Error('the stage has no course')
    value.course.extension = items
  } else value.theme[list.slice('theme.'.length)] = items
  return {
    value: value as unknown as StageDocument['value'],
    ids: { ...document.ids, [LIST_IDS[list]]: ids },
  }
}

export function removeElement(document: StageDocument, list: ListName, index: number): StageDocument {
  const { items, ids } = listOf(document, list)
  items.splice(index, 1)
  ids.splice(index, 1)
  return withList(document, list, items, ids)
}

export function insertElement(
  document: StageDocument,
  list: ListName,
  index: number,
  element: unknown,
  id: string,
): StageDocument {
  const { items, ids } = listOf(document, list)
  items.splice(index, 0, element)
  ids.splice(index, 0, id)
  return withList(document, list, items, ids)
}

export function moveElement(
  document: StageDocument,
  list: ListName,
  from: number,
  to: number,
): StageDocument {
  const { items, ids } = listOf(document, list)
  const [item] = items.splice(from, 1)
  const [id] = ids.splice(from, 1)
  items.splice(to, 0, item)
  ids.splice(to, 0, id as string)
  return withList(document, list, items, ids)
}

/** A copy of the document without its course, and so without the ids of the course's extension. */
export function removeCourse(document: StageDocument): StageDocument {
  const { copy } = editedCopy(document, ['course'])
  const value = { ...(copy.value as unknown as Record<string, unknown>) }
  delete value.course
  return { value: value as unknown as StageDocument['value'], ids: { ...document.ids, extension: [] } }
}
