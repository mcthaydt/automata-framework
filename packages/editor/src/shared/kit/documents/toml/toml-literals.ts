import { parseDocument } from '@decimalturn/toml-patch'
import { type KeyPath, keyPathText } from '../key-path'

// Where every value of a TOML text is written, and the comments around each key (editor suite spec §4.4). It reads the
// concrete syntax tree of `@decimalturn/toml-patch`, the parser the documents write through, so the two agree on what a
// text means. The tree gives 1-based lines and UTF-16 columns; a span is [start, end) in the text, and each one is
// checked to slice to its literal's own text, so a disagreement throws here instead of becoming a wrong edit.

/** The parser's positions do not slice to a literal's text: a bug to report, never a text to edit. */
export class TomlPositionError extends Error {}

export interface TomlLiteral {
  readonly keyPath: KeyPath
  readonly span: readonly [number, number]
  /** The literal as written: quotes, escapes, underscores and a float's `.0` included. */
  readonly text: string
}

export interface TomlComments {
  readonly before?: string
  readonly trailing?: string
}

export interface TomlLiterals {
  /** Every scalar, in document order. */
  readonly literals: readonly TomlLiteral[]
  /** The comments of a key or a table header; `{}` when it has none or is not in the text. */
  comments(keyPath: KeyPath): TomlComments
}

// The few shapes of toml-patch's tree read here (the package does not export its node types).
interface Position {
  readonly line: number
  readonly column: number
}
interface Node {
  readonly type: string
  readonly loc: { readonly start: Position; readonly end: Position }
}
interface KeyNode extends Node {
  readonly value: readonly string[]
}
interface ValueNode extends Node {
  readonly raw?: string
  readonly value?: unknown
  readonly items?: readonly { readonly item: Node }[]
}
interface KeyValueNode extends Node {
  readonly key: KeyNode
  readonly value: ValueNode
}
interface CommentNode extends Node {
  readonly raw: string
}
interface TableNode extends Node {
  readonly key: { readonly item: KeyNode }
  readonly items: readonly Node[]
}

const SCALARS = new Set(['String', 'Integer', 'Float', 'Boolean', 'DateTime'])

/** A row of the text as a reader sees it: a key, a table header or a comment line, in document order. */
type Row =
  | { readonly kind: 'comment'; readonly node: CommentNode }
  | { readonly kind: 'key'; readonly node: Node; readonly keyPath: KeyPath }

/** The text of a comment without its `#` and one following space. */
const commentText = (raw: string): string => raw.replace(/^#[ \t]?/, '')

export function readTomlLiterals(text: string): TomlLiterals {
  const lineStarts = [0]
  for (let at = text.indexOf('\n'); at >= 0; at = text.indexOf('\n', at + 1)) lineStarts.push(at + 1)
  const offset = ({ line, column }: Position): number => (lineStarts[line - 1] ?? text.length) + column

  const literals: TomlLiteral[] = []
  const rows: Row[] = []

  const visitValue = (node: ValueNode, keyPath: KeyPath): void => {
    if (SCALARS.has(node.type)) {
      const span = [offset(node.loc.start), offset(node.loc.end)] as const
      const written = text.slice(...span)
      const expected = node.raw ?? String(node.value)
      if (written !== expected)
        throw new TomlPositionError(
          `TOML positions disagree at ${keyPathText(keyPath)}: ${written} is not ${expected}`,
        )
      literals.push({ keyPath, span, text: written })
      return
    }
    if (node.type === 'InlineArray') {
      for (const [index, entry] of (node.items ?? []).entries())
        visitValue(entry.item as ValueNode, [...keyPath, index])
      return
    }
    if (node.type === 'InlineTable') {
      for (const entry of node.items ?? []) {
        const member = entry.item as KeyValueNode
        visitValue(member.value, [...keyPath, ...member.key.value])
      }
    }
  }

  const visitRows = (items: readonly Node[], prefix: KeyPath): void => {
    for (const item of items) {
      if (item.type === 'Comment') rows.push({ kind: 'comment', node: item as CommentNode })
      else if (item.type === 'KeyValue') {
        const keyValue = item as KeyValueNode
        const keyPath = [...prefix, ...keyValue.key.value]
        rows.push({ kind: 'key', node: item, keyPath })
        visitValue(keyValue.value, keyPath)
      }
    }
  }

  // A header names its table from the root; a key that is an array of tables so far means its last element.
  const arrayCounts = new Map<string, number>()
  const resolve = (keys: readonly string[]): (string | number)[] => {
    const path: (string | number)[] = []
    for (const key of keys) {
      path.push(key)
      const count = arrayCounts.get(keyPathText(path))
      if (count !== undefined) path.push(count - 1)
    }
    return path
  }

  for (const block of parseDocument(text).cst as unknown as readonly Node[]) {
    if (block.type === 'Table') {
      const table = block as TableNode
      const keyPath = resolve(table.key.item.value)
      rows.push({ kind: 'key', node: table.key.item, keyPath })
      visitRows(table.items, keyPath)
    } else if (block.type === 'TableArray') {
      const table = block as TableNode
      const keys = table.key.item.value
      const arrayPath = [...resolve(keys.slice(0, -1)), keys[keys.length - 1] as string]
      const count = arrayCounts.get(keyPathText(arrayPath)) ?? 0
      arrayCounts.set(keyPathText(arrayPath), count + 1)
      const keyPath = [...arrayPath, count]
      rows.push({ kind: 'key', node: table.key.item, keyPath })
      visitRows(table.items, keyPath)
    } else visitRows([block], [])
  }

  const comments = new Map<string, TomlComments>()
  for (const [index, row] of rows.entries()) {
    if (row.kind !== 'key') continue
    const next = rows[index + 1]
    const trailing =
      next?.kind === 'comment' && next.node.loc.start.line === row.node.loc.end.line
        ? commentText(next.node.raw)
        : undefined
    // The run of whole-line comments directly above: each on the line before the last, none sharing a line with code.
    const above: string[] = []
    let line = row.node.loc.start.line
    for (let back = index - 1; back >= 0; back--) {
      const previous = rows[back] as Row
      if (previous.kind !== 'comment' || previous.node.loc.start.line !== line - 1) break
      const before = rows[back - 1]
      if (before !== undefined && before.node.loc.end.line === previous.node.loc.start.line) break
      above.unshift(commentText(previous.node.raw))
      line = previous.node.loc.start.line
    }
    comments.set(keyPathText(row.keyPath), {
      ...(above.length > 0 ? { before: above.join('\n') } : {}),
      ...(trailing !== undefined ? { trailing } : {}),
    })
  }

  return { literals, comments: (keyPath) => comments.get(keyPathText(keyPath)) ?? {} }
}
