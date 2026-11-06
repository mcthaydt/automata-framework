// Extracted from the adventure source editor/src/server/json-structure.ts, its "Layout" half: how a hand-formatted
// JSON file writes its values, so that a value added to it looks like the ones already there.

/** Lines of packed items are filled up to this many characters. */
export const PACK_WIDTH = 120

export interface Layout {
  /** The file's indent unit: the shallowest indentation of any line. */
  readonly unit: string
  /** Whether the file writes even short number arrays one number per line (`JSON.stringify(…, 2)` style). */
  readonly expandsEverything: boolean
  /** Brace spacing of inline objects, by the file's majority: `{ "a": 1 }` (true) or `{"a": 1}` (false). */
  readonly bracesSpaced: boolean
}

export function readLayout(text: string): Layout {
  let unit: string | undefined
  for (const match of text.matchAll(/\n([ \t]+)\S/g)) {
    const indent = match[1] as string
    if (unit === undefined || indent.length < unit.length) unit = indent
  }
  const spaced = (text.match(/\{ "/g) ?? []).length
  const tight = (text.match(/\{"/g) ?? []).length
  return {
    unit: unit ?? '  ',
    expandsEverything: /\[\s*\n\s*-?[\d.]+,[ \t]*\n\s*-?[\d.]+/.test(text),
    bracesSpaced: spaced >= tight,
  }
}

export const lineStart = (text: string, position: number): number => text.lastIndexOf('\n', position - 1) + 1

/** The indentation of the line `position` is on. */
export const indentAt = (text: string, position: number): string =>
  /^[ \t]*/.exec(text.slice(lineStart(text, position)))?.[0] ?? ''

/** Whether two positions are on one line. */
export const sameLine = (text: string, a: number, b: number): boolean =>
  !text.slice(Math.min(a, b), Math.max(a, b)).includes('\n')
