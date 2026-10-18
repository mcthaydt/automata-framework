// The board check (M5 spec §4.8, L-b): every board a game names must be declared in its ship config's
// `leaderboards`, the table `ruken.toml` is written from, or Ruken has no such board to take the score (FloorFifty
// `score-boards.ts` keeps one list for the same reason). The game's own sources are read, not the bundle, so a
// failure names the call site the developer wrote:
// - `scores: { <event>: { board: '<name>', … } }` in `defineGame`;
// - `submitScore('<name>', …)` and `readBoard('<name>', …)`, as a method or a plain call.
// Only string literals are checked. A board passed as a value is left to its type (the game's `Leaderboards<Board>`).

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { parseSync } from 'oxc-parser'

export interface UndeclaredBoardFound {
  readonly board: string
  /** Relative to the game folder, with forward slashes. */
  readonly file: string
  /** 1-based, at the board name's opening quote. */
  readonly line: number
  readonly col: number
}

const SOURCE = /\.(?:ts|tsx|mts|js|mjs)$/
/** Dependencies, the build and tool folders are not the game's sources. */
const SKIPPED = new Set(['node_modules', 'dist'])
const BOARD_CALLS = new Set(['submitScore', 'readBoard'])

function sources(dir: string): string[] {
  return readdirSync(dir)
    .sort()
    .flatMap((name) => {
      if (SKIPPED.has(name) || name.startsWith('.')) return []
      const path = join(dir, name)
      const stats = statSync(path, { throwIfNoEntry: false })
      if (stats === undefined) return []
      if (stats.isDirectory()) return sources(path)
      return SOURCE.test(name) ? [path] : []
    })
}

type Node = Record<string, unknown>
const isNode = (value: unknown): value is Node => value !== null && typeof value === 'object'
const stringLiteral = (value: unknown): value is Node & { value: string; start: number } =>
  isNode(value) &&
  value.type === 'Literal' &&
  typeof value.value === 'string' &&
  typeof value.start === 'number'
const nameOf = (node: unknown): string | undefined => {
  if (!isNode(node)) return undefined
  if (node.type === 'Identifier') return node.name as string
  if (node.type === 'MemberExpression' && isNode(node.property) && node.property.type === 'Identifier')
    return node.property.name as string
  return undefined
}
const keyOf = (property: Node): string | undefined =>
  isNode(property.key) ? ((property.key.name ?? property.key.value) as string | undefined) : undefined

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

function position(code: string, offset: number): { line: number; col: number } {
  const before = code.slice(0, offset)
  const lineStart = before.lastIndexOf('\n') + 1
  return { line: before.split('\n').length, col: offset - lineStart + 1 }
}

/** A board a source file names, by its name and position (1-based, at the opening quote). */
export interface BoardName {
  readonly board: string
  readonly line: number
  readonly col: number
}

/** Whether `file` is one of the game's sources the board check reads (`.ts`, `.tsx`, `.mts`, `.js`, `.mjs`). */
export const isBoardSource = (file: string): boolean =>
  SOURCE.test(file) && !file.split('/').some((part) => SKIPPED.has(part) || part.startsWith('.'))

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
