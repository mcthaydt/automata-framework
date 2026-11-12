// biome-ignore-all lint/style/noNonNullAssertion: the compiler needs these assertions until the strict flags (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`) replace each with a check
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { gunzipSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import { BASE, member, SPRITE_PITCH } from '#src/entries/index.ts'
import { lightFigure } from '#src/shared/lighting/light.ts'
import { cellOf } from '#src/shared/stage/cell.ts'
import { project } from '#src/shared/stage/pose.ts'
import { compose, STAGE_VERSION } from '#src/shared/stage/stage.ts'
import { GOLDEN_DENSITIES } from '../../fixtures/frames/base'
import { LIT_SETUPS, standingFigure } from '../../fixtures/frames/lit'
import { md5, ortho } from '../../fixtures/stage'
import { sheetFigures } from '../../fixtures/view-sheets.ts'

/**
 * The contract loses nothing: every golden sheet frame, redrawn through `cellOf` and `compose` as one centred sprite at
 * zoom = density, equals the sheet's every visible texel (alpha at every texel, colour where alpha is set: the sheets
 * leave stale colour under alpha 0, which is not part of the look). And the lit goldens, through `cellOf`.
 */
const PITCH = SPRITE_PITCH

describe('the stage keeps the base goldens', () => {
  for (const density of GOLDEN_DENSITIES)
    it(`every sheet frame at density ${density}`, () => {
      for (const c of BASE) {
        const cast = member(c.def, density),
          [w, h] = cast.cell,
          n = w * h * 4
        const sheets = new Map(
          ['turn', 'walk', 'hero'].map((k) => [
            k,
            gunzipSync(
              readFileSync(
                resolve(
                  import.meta.dirname,
                  '../../fixtures/golden/base',
                  `${c.def.id}-${k}-d${density}.rgba.gz`,
                ),
              ),
            ),
          ]),
        )
        let checked = 0
        sheetFigures(
          cast,
          PITCH,
          (kind, i, figure) => {
            const camera = ortho(density, [w, h])
            const out = compose({
              version: STAGE_VERSION,
              camera,
              sprites: [
                {
                  name: c.def.id,
                  cell: cellOf(figure),
                  at: [0, 0, 0],
                  screen: [0, 0],
                  scale: 1,
                  depth: project(camera, [0, 0, 0])[2],
                },
              ],
            })
            const want = sheets.get(kind)!.subarray(i * n, (i + 1) * n)
            let bad = 0
            for (let p = 0; p < n; p += 4) {
              if (
                out[p + 3] !== want[p + 3] ||
                (want[p + 3] && [0, 1, 2].some((k) => out[p + k] !== want[p + k]))
              )
                bad++
            }
            expect(bad, `${c.def.id} ${kind}${i} at D${density}`).toBe(0)
            checked++
          },
          c.pose,
        )
        expect(checked).toBe(8 + cast.gait.walkPoses + 1)
      }
    })
  it('every lit golden frame, through cellOf', () => {
    const want = JSON.parse(
      readFileSync(resolve(import.meta.dirname, '../../fixtures/golden/lit.json'), 'utf8'),
    ) as Record<string, string>
    let n = 0
    for (const s of LIT_SETUPS)
      for (const c of BASE)
        for (const D of s.densities)
          for (const d of [0, 1, 2, 3, 5]) {
            const f = standingFigure(c.def.id, D, d),
              lit = lightFigure(f, { time: s.time, lamps: s.lamps, t: s.t, shade: s.shade, bounce: s.bounce })
            expect(md5(cellOf(f, lit).rgba), `${c.def.id}/${s.name}/${d}@D${D}`).toBe(
              want[`${c.def.id}/${s.name}/${d}@D${D}`],
            )
            n++
          }
    expect(n).toBe(Object.keys(want).length)
  })
})
