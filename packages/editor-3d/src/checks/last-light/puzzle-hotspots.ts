// Extracted from The Last Light scripts/pipeline/blockout-lib.ts, the `puzzle-hotspots` check (92e6704): every hotspot the
// scene's puzzle acts on (its actions' places and its fallbacks') is placed in the level. The puzzle is not part of the
// file, so the caller gives its hotspot ids; `null` is a level with no puzzle. A hotspot that is not placed has no place
// in the document to point at, so its problem has no locator.
import type { Expanded } from '../../format/expand'
import type { Problem } from '../check'

export function puzzleHotspotProblems(expanded: Expanded, wanted: readonly string[] | null): Problem[] {
  if (wanted === null) return []
  return wanted
    .filter((id) => !expanded.hotspots.some((hotspot) => hotspot.id === id))
    .map((id) => ({ message: `puzzle hotspot ${id} is not placed` }))
}
