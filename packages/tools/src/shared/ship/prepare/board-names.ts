// The board check: every board a game names must be declared in its ship config's
// `leaderboards`, the table `ruken.toml` is written from, or Ruken has no such board to take the score (FloorFifty
// `score-boards.ts` keeps one list for the same reason). The game's own sources are read, not the bundle, so a
// failure names the call site the developer wrote:
// - `scores: { <event>: { board: '<name>', … } }` in `defineGame`;
// - `submitScore('<name>', …)` and `readBoard('<name>', …)`, as a method or a plain call.
// Only string literals are checked. A board passed as a value is left to its type (the game's `Leaderboards<Board>`).

import { readFileSync } from 'node:fs'
import { relative, sep } from 'node:path'
import { parseSync } from 'oxc-parser'
import {
  isGameSource,
  isNode,
  keyOf,
  type Node,
  nameOf,
  position,
  sources,
  stringLiteral,
} from './source-reader.ts'

/** A board the game's sources name that its ship config does not declare, at the call site. */
export interface UndeclaredBoardFound {
  readonly board: string
  /** Relative to the game folder, with forward slashes. */
  readonly file: string
  /** 1-based, at the board name's opening quote. */
  readonly line: number
  readonly col: number
}

const BOARD_CALLS = new Set(['submitScore', 'readBoard'])

/** The board-name literals in one file's syntax tree. */
function boardLiterals(program: unknown): (Node & { value: string; start: number })[] {
  const found: (Node & { value: string; start: number })[] = []
  const visit = (node: unknown): void => {
    if (Array.isArray(node)) {
      for (const child of node) visit(child)
      return
    }
    if (!isNode(node)) return
    if (node.type === 'CallExpression' && BOARD_CALLS.has(nameOf(node.callee) ?? '')) {
      const first = (node.arguments as unknown[])[0]
      if (stringLiteral(first)) found.push(first)
    }
    if (
      node.type === 'Property' &&
      keyOf(node) === 'scores' &&
      isNode(node.value) &&
      node.value.type === 'ObjectExpression'
    ) {
      for (const entry of node.value.properties as unknown[]) {
        if (!isNode(entry) || !isNode(entry.value) || entry.value.type !== 'ObjectExpression') continue
        for (const field of entry.value.properties as unknown[])
          if (isNode(field) && keyOf(field) === 'board' && stringLiteral(field.value)) found.push(field.value)
      }
    }
    for (const value of Object.values(node)) if (typeof value === 'object') visit(value)
  }
  visit(program)
  return found
}

/** A board a source file names, by its name and position (1-based, at the opening quote). */
export interface BoardName {
  readonly board: string
  readonly line: number
  readonly col: number
}

/** Whether `file` is one of the game's sources the board check reads (`.ts`, `.tsx`, `.mts`, `.js`, `.mjs`). */
export const isBoardSource: (file: string) => boolean = isGameSource

/**
 * The boards one source file names, in source order; `undefined` when it does not parse (its typecheck already
 * fails, and a half-read tree could report a board that is not there). `automata check` reads files through its
 * own `Files` and calls this; `findUndeclaredBoards` walks the disk.
 */
export function boardNamesIn(file: string, code: string): BoardName[] | undefined {
  const parsed = parseSync(file, code)
  if (parsed.errors.length > 0) return undefined
  return boardLiterals(parsed.program)
    .sort((a, b) => a.start - b.start)
    .map((literal) => ({ board: literal.value, ...position(code, literal.start) }))
}

/**
 * The board ids a `ship.config.ts` declares: the keys of its `leaderboards` object, read from the source as written
 * (`automata check` reads files, it does not run them). `undefined` when the file does not parse, or `leaderboards`
 * is not written as an object (a spread or a variable), so the check says it could not read the boards.
 */
export function declaredBoardsIn(code: string): string[] | undefined {
  const parsed = parseSync('ship.config.ts', code)
  if (parsed.errors.length > 0) return undefined
  let boards: string[] | undefined = []
  const visit = (node: unknown): void => {
    if (Array.isArray(node)) {
      for (const child of node) visit(child)
      return
    }
    if (!isNode(node)) return
    if (node.type === 'Property' && keyOf(node) === 'leaderboards') {
      if (!isNode(node.value) || node.value.type !== 'ObjectExpression') boards = undefined
      else if (boards !== undefined)
        for (const entry of node.value.properties as unknown[]) {
          const key = isNode(entry) && entry.type === 'Property' ? keyOf(entry) : undefined
          if (key === undefined) boards = undefined
          else boards?.push(key)
        }
      return
    }
    for (const value of Object.values(node)) if (typeof value === 'object') visit(value)
  }
  visit(parsed.program)
  return boards
}

/** Every board a game's sources name that `declared` (its ship config's `leaderboards` keys) lacks. */
export function findUndeclaredBoards(gameDir: string, declared: readonly string[]): UndeclaredBoardFound[] {
  const known = new Set(declared)
  return sources(gameDir).flatMap((path) =>
    (boardNamesIn(path, readFileSync(path, 'utf8')) ?? [])
      .filter((name) => !known.has(name.board))
      .map((name) => ({ ...name, file: relative(gameDir, path).split(sep).join('/') })),
  )
}
