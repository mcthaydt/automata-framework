// What the static checks over a game's sources share (the board check and the orientation check):
// which files are the game's sources, and the few syntax-tree helpers they need. The checks read the code as
// written with `oxc-parser`; they never load a game, which cannot run under plain Node.

import { readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const SOURCE = /\.(?:ts|tsx|mts|js|mjs)$/
/** Dependencies, the build and tool folders are not the game's sources. */
const SKIPPED = new Set(['node_modules', 'dist'])

/** Every source file under `dir`, in name order, skipping dependencies, the build and dot folders. */
export function sources(dir: string): string[] {
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

/** Whether `file` (relative, forward slashes) is one of the game's sources. */
export const isGameSource = (file: string): boolean =>
  SOURCE.test(file) && !file.split('/').some((part) => SKIPPED.has(part) || part.startsWith('.'))

const TESTS = /\.(?:test|spec)\./

/** Whether `file` is one of the game's shipped sources: a source, and not a test, whose fixture games are not shipped. */
export const isShippedSource = (file: string): boolean =>
  isGameSource(file) && !TESTS.test(file.slice(file.lastIndexOf('/') + 1))

export type Node = Record<string, unknown>
export const isNode = (value: unknown): value is Node => value !== null && typeof value === 'object'
export const stringLiteral = (value: unknown): value is Node & { value: string; start: number } =>
  isNode(value) &&
  value.type === 'Literal' &&
  typeof value.value === 'string' &&
  typeof value.start === 'number'
/** The name of an identifier, or of the property in `a.b`. */
export const nameOf = (node: unknown): string | undefined => {
  if (!isNode(node)) return undefined
  if (node.type === 'Identifier') return node.name as string
  if (node.type === 'MemberExpression' && isNode(node.property) && node.property.type === 'Identifier')
    return node.property.name as string
  return undefined
}
/** The key of an object property, written as a name or as a string. */
export const keyOf = (property: Node): string | undefined =>
  isNode(property.key) ? ((property.key.name ?? property.key.value) as string | undefined) : undefined

/** 1-based line and column of a character offset. */
export function position(code: string, offset: number): { line: number; col: number } {
  const before = code.slice(0, offset)
  const lineStart = before.lastIndexOf('\n') + 1
  return { line: before.split('\n').length, col: offset - lineStart + 1 }
}
