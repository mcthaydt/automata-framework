// What the level, the world builder and the checks report: a place in the file, a stable code and a sentence,
// plus the room, prop or lamp it is about and, for a missing thing, its name. Nothing that reads a level throws on one
// it cannot build; it hands these back, so a half-made level still draws and `automata check` can name each fault.

/** A path into a level file: object keys and array indices, as content's `DataPath`. */
export type LevelPath = readonly (string | number)[]

export interface LevelProblem {
  /** Where in the file the fault is, so a tool can put it on a line. */
  readonly path: LevelPath
  /** A stable code (`invalid-level`, `unknown-format`, `unknown-kit`, …): tests and tools match on it. */
  readonly code: string
  /** A sentence that says what to change. */
  readonly message: string
  /** The room, prop or lamp id the fault is in, or the JSON path of the member when it is in none. */
  readonly where: string
  /** The missing kit, prop, swatch or time. */
  readonly name?: string | undefined
}

/** `sectors[1].corners[0]` for a path: the form a person finds in the file. */
export function pathText(path: LevelPath): string {
  return path.reduce<string>(
    (text, part) => (typeof part === 'number' ? `${text}[${part}]` : text === '' ? part : `${text}.${part}`),
    '',
  )
}
