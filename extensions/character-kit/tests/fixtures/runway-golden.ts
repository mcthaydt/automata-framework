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

/**
 * Cells another arch paints differently from the shared md5 (the one the golden holds, made on Linux x64), by
 * `<model>/<body>/<direction>` and then `process.arch`. Everything not named here must match the shared md5 on every arch, so a new
 * arch difference still fails and prints its diff (`cell-miss.ts`).
 *
 * `nia/thin/0` on arm64 (macOS, Node 24.21.0; CI run 42970605098, the Macs' runners): 2 of the cell's 98,304 bytes' texels differ, row 74,
 * columns 55 and 56, one colour step darker (`#23324d` on x64, `#181f2f` on arm64): the last two texels of a diagonal band fall on the
 * other side of a threshold in FigureBuilder's painter. Presentation, not the sim: the cell is CPU-painted, and FigureBuilder's own
 * goldens are recorded on one platform. Follow-up, in FigureBuilder: make the painter's thresholds arch-stable, then drop this.
 */
export const ARCH_OVERRIDES: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  'nia/thin/0': { arm64: '259c7a376180713d893c1fdf5ac99b3e' },
}

/** The md5 a fit-check cell is expected to have on `arch` (this machine's by default). */
export function expectedFitMd5(
  id: string,
  body: string,
  direction: number,
  arch: string = process.arch,
): string | undefined {
  return (
    ARCH_OVERRIDES[`${id}/${body}/${direction}`]?.[arch] ?? RUNWAY_GOLDEN.fit[id]?.[body]?.[String(direction)]
  )
}
