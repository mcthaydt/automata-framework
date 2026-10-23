import { type Block, isBlank } from './toml-blocks'

// The line operations of the block engine (EDFF.1a decisions 3 and 9). Each takes the lines of a text and a block of it
// (from `scanBlocks` of those same lines) and returns new lines; the input is not changed. A table is the lines from
// its own comments (`start`) to its last key (`last`); the blank lines and floating comments after it are its gap.
// Tables are separated by one blank line, as in every shipped stage.

/** The lines of a table with its own comments: what moving it takes along. */
export function tableLines(lines: readonly string[], block: Block): string[] {
  return lines.slice(block.start, block.last + 1)
}

/**
 * Removes a table, its own comments and the blank lines right after it. A comment the gap holds stays where it was,
 * still one blank line below what came before. When nothing follows the table, the blank lines before it go too, so the
 * text does not end in a separator that has nothing left to separate.
 */
export function removeTable(lines: readonly string[], block: Block): string[] {
  let end = block.last + 1
  while (end < lines.length && isBlank(lines[end] ?? '')) end += 1
  let start = block.start
  if (end === lines.length) while (start > 0 && isBlank(lines[start - 1] ?? '')) start -= 1
  return [...lines.slice(0, start), ...lines.slice(end)]
}

/** Puts `table` right after the last key of `after`, one blank line between; its gap follows the new table. */
export function insertAfter(lines: readonly string[], after: Block, table: readonly string[]): string[] {
  const at = after.last + 1
  return [...lines.slice(0, at), '', ...table, ...lines.slice(at)]
}

/** Puts `table` right before the own comments of `before`, one blank line between. */
export function insertBefore(lines: readonly string[], before: Block, table: readonly string[]): string[] {
  return [...lines.slice(0, before.start), ...table, '', ...lines.slice(before.start)]
}

/** Puts `table` after the last line with content, ahead of any blank lines the text ends with. */
export function appendTable(lines: readonly string[], table: readonly string[]): string[] {
  let end = lines.length
  while (end > 0 && isBlank(lines[end - 1] ?? '')) end -= 1
  return [...lines.slice(0, end), ...(end > 0 ? [''] : []), ...table, ...lines.slice(end)]
}
