// The runway golden (`goldens/runway-cells.json`, made by `scripts/record-runway-cells.ts` from the showcase's own wardrobe), read
// for the tests that hold the kit's wardrobe to it.
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
