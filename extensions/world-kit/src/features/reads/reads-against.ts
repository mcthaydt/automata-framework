// A figure against its room: what a level's declared `reads` hold a frame to. Every figure's edge must be at least
// `minEdge` (1.1× unless the level says), and no figure may be hot (brighter than its ring by more than `HOT`) unless the
// level waives it with `hot: true`. The numbers come from the frame (`figureReads`); this says what fails.

import type { LevelReads } from '@automata/3d/level'
import type { FigureRead } from './figure-reads.ts'

/** The weakest a figure may read (edge or luma against its room). */
export const MIN_READ = 1.1

/** The hottest a figure may be against its ring (luma over luma). A figure brighter than this reads as lit from nowhere. */
export const HOT = 1.1

export const isHot = (figure: FigureRead): boolean => figure.figure > HOT * figure.around

/** What a level's frames keep unless it declares otherwise. */
export const DEFAULT_READS: { readonly minEdge: number; readonly hot: boolean } = {
  minEdge: MIN_READ,
  hot: false,
}

/** A measure to two places, or three where two would read as the limit it is judged against (`edge 1.10 < 1.1` for 1.0996,
 * which fails): a verdict never shows a value equal to the limit it fails. */
const shown = (value: number, limit: number): string => {
  const text = value.toFixed(2)
  return Number(text) === limit ? value.toFixed(3) : text
}

const hotIssue = (figure: FigureRead, index: number): string =>
  `figure ${index + 1}: hot ${shown(figure.figure / figure.around, HOT)} > ${HOT}`

/** What fails in one frame against a level's reads: for each figure in turn (1 is the first found), its edge where it is
 * under `minEdge` (`figure 2: edge 0.99 < 1.1`), then, unless the level waives it with `hot`, where it is hot
 * (`figure 1: hot 1.77 > 1.1`). Empty when the frame passes. */
export function readsAgainst(figures: readonly FigureRead[], declared: LevelReads = {}): string[] {
  const minEdge = declared.minEdge ?? DEFAULT_READS.minEdge
  const hot = declared.hot ?? DEFAULT_READS.hot
  return figures.flatMap((figure, i) => [
    ...(figure.edge < minEdge ? [`figure ${i + 1}: edge ${shown(figure.edge, minEdge)} < ${minEdge}`] : []),
    ...(!hot && isHot(figure) ? [hotIssue(figure, i)] : []),
  ])
}

/** What a level's `hot: true` lets through in one frame, worded as `readsAgainst` words a failure. A frame that passes by a
 * waiver is ok and not clean: the debt is seen on every run. */
export const waivedBy = (figures: readonly FigureRead[], declared: LevelReads = {}): string[] =>
  declared.hot === true ? figures.flatMap((f, i) => (isHot(f) ? [hotIssue(f, i)] : [])) : []
