// The runway golden (`goldens/runway-cells.json`, made by `scripts/record-runway-cells.ts` from the showcase's own wardrobe), read
// for the tests that hold the kit's wardrobe to it.
//
// It was re-recorded once for the builder's hair-pole rule (42 of 112 cells, 281 texels, all of them hair). Twelve of those texels are darker
// than every unchanged hair texel beside them; the coordinator's ruling (2026-11-11: a hair or ear
// texel moved by the pole rule is accepted) covers them, and all twelve are hair (parts 2101 to 2139, the crown or fringe of a band):
// docs/refactor/c8/runway-hair-poles/ (runway-darker.png, runway-darker.json).
import { readFileSync } from 'node:fs'

export interface RunwayGolden {
  readonly figureBuilder: string
  readonly density: number
  /** The directions each model is recorded in on its own body. */
  readonly directions: readonly number[]
  /** md5 of the painted cell: model id, then direction. */
  readonly cells: Readonly<Record<string, Readonly<Record<string, string>>>>
  /** The slider extremes of the showcase's fit check, by name, and the directions it draws them in. */
  readonly bodies: Readonly<Record<string, Readonly<Record<string, number>>>>
  readonly fitDirections: readonly number[]
  /** md5 of the painted cell: model id, then body, then direction. */
  readonly fit: Readonly<Record<string, Readonly<Record<string, Readonly<Record<string, string>>>>>>
}

export const RUNWAY_GOLDEN = JSON.parse(
  readFileSync(new URL('./goldens/runway-cells.json', import.meta.url), 'utf8'),
) as RunwayGolden
