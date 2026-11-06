// Reading a JSON file for a structural edit: the scanned file with its layout, the node at a path, and the
// error an edit raises when the file cannot take it.
import { type Layout, readLayout } from './layout'
import { type JsonNode, type JsonPath, JsonScanError, type Scan, scan } from './locate'
import type { NumberStyle } from './print'

export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue }

/** The edit cannot be made: a path that is not there, a container of the wrong kind, a duplicate member. */
export class JsonShapeError extends Error {
  readonly path: JsonPath

  constructor(message: string, path: JsonPath = []) {
    super(message)
    this.path = path
  }
}

export interface Source {
  readonly text: string
  readonly scanned: Scan
  readonly layout: Layout
  readonly numbers: NumberStyle
}

export function read(text: string, numbers: NumberStyle): Source {
  try {
    return { text, scanned: scan(text), layout: readLayout(text), numbers }
  } catch (error) {
    if (error instanceof JsonScanError) throw new JsonShapeError(`not valid JSON: ${error.message}`)
    throw error
  }
}

/** The node at `path`, or the shortest prefix of it that does not exist. */
export function nodeAt(source: Source, path: JsonPath): JsonNode {
  for (let length = 0; length <= path.length; length++) {
    if (!source.scanned.node(path.slice(0, length))) {
      throw new JsonShapeError(`${JSON.stringify(path.slice(0, length))} does not exist`, path)
    }
  }
  return source.scanned.node(path) as JsonNode
}

export const child = (node: JsonNode, index: number): JsonNode => {
  const found = node.children[index]
  if (!found) throw new JsonShapeError(`${JSON.stringify([...node.path, index])} does not exist`, node.path)
  return found
}

/** A member runs from its key; an element is just its value. */
export const itemStart = (node: JsonNode): number => node.keySpan?.start ?? node.span.start
export const itemEnd = (node: JsonNode): number => node.span.end
export const memberName = (node: JsonNode): string => String(node.path[node.path.length - 1])
export const isMultiline = (source: Source, node: JsonNode): boolean =>
  source.text.slice(node.span.start, node.span.end).includes('\n')
