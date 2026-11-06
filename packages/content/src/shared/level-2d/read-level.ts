import type { ContentEntityItem, ContentLevel, ContentLevelLayer } from './content.schema'

// Reading an exported level in a game. Sim-safe on purpose (no Node, no clock, no randomness, no key enumeration): a
// game's sim may import this file, so its levels are read one way in every engine. A level that passed
// `levelContentSchema` can still hold a row that is not a number, so reading throws a sentence naming the level, the
// layer and the row.

/** The layer called `layer`, or a sentence saying it is not there. */
function layerOf(level: ContentLevel, layer: string): ContentLevelLayer {
  const found = level.layers.find((candidate) => candidate.def === layer)
  if (found === undefined) throw new Error(`Level ${level.id} has no layer "${layer}".`)
  return found
}

/** One row of the file's run-length text (`1 .*38 1`) as one number per cell; `.` is an empty cell, 0. */
function cellsOfRow(row: string, where: string): number[] {
  const cells: number[] = []
  const trimmed = row.trim()
  const tokens = trimmed === '' ? [] : trimmed.split(/\s+/)
  for (const token of tokens) {
    const star = token.indexOf('*')
    const base = star === -1 ? token : token.slice(0, star)
    const countText = star === -1 ? '1' : token.slice(star + 1)
    if (!/^[1-9]\d*$/.test(countText)) throw new Error(`${where}: "${token}" has a bad repeat count.`)
    if (base !== '.' && !/^\d+$/.test(base)) throw new Error(`${where}: "${token}" is not a number.`)
    const value = base === '.' ? 0 : Number(base)
    for (let i = 0; i < Number(countText); i++) cells.push(value)
  }
  return cells
}

/** The cells of an IntGrid layer, one array of numbers per row (0 is empty). Throws for a missing or other layer. */
export function intGridRows(level: ContentLevel, layer: string): readonly (readonly number[])[] {
  const found = layerOf(level, layer)
  if (found.kind !== 'intgrid')
    throw new Error(
      `Level ${level.id}, layer ${layer}: it is ${article(found.kind)} ${found.kind} layer, not an IntGrid layer.`,
    )
  return found.rows.map((row, y) => cellsOfRow(row, `Level ${level.id}, layer ${layer}, row ${y}`))
}

/** The items of an entities layer, in file order. Throws for a missing or other layer. */
export function entitiesOf(level: ContentLevel, layer: string): readonly ContentEntityItem[] {
  const found = layerOf(level, layer)
  if (found.kind !== 'entities')
    throw new Error(
      `Level ${level.id}, layer ${layer}: it is ${article(found.kind)} ${found.kind} layer, not an entities layer.`,
    )
  return found.items
}

const article = (word: string): string => (/^[aeiou]/.test(word) ? 'an' : 'a')
