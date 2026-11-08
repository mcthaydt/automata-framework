export type Path = readonly (string | number)[]
type Node = Record<string | number, unknown>

/** A deep copy of `file` with `value` at `parent[key]`; `undefined` deletes the key. For tests that damage a fixture. */
export function edited(parent: Path, key: string | number, value: unknown, file: unknown): unknown {
  const copy = structuredClone(file)
  let node = copy as Node
  for (const step of parent) node = node[step] as Node
  if (value === undefined) delete node[key]
  else node[key] = value
  return copy
}
