import { parseStage } from '../stage-codec'
import type { StageDocument } from '../stage-document'

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
