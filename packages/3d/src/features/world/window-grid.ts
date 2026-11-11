// A facade's grid of windows as decor, lit by a seeded share at night.
import { createRng } from '@automata/sim'
import type { Decor, WindowGrid } from '../../shared/level/af-sector-2.schema.ts'
import type { Segment } from './sectors.ts'

const lerp = (a: number, b: number, u: number): number => a + (b - a) * u

/** A facade's grid of windows as decor, lit by a seeded share at night. */
export function windowsOf(grid: WindowGrid, seg: Segment, night: boolean, horizontal: boolean): Decor[] {
  const rng = createRng(grid.seed ?? seg.sector * 31 + seg.edge)
  const out: Decor[] = []
  for (let row = 0; row < grid.rows; row++)
    for (let col = 0; col < grid.cols; col++) {
      const t = (col + 0.5) / grid.cols
      const pos = horizontal ? lerp(seg.a[0], seg.b[0], t) : lerp(seg.a[1], seg.b[1], t)
      const lit = night && rng.next() < (grid.lit ?? 0.5)
      out.push({
        kind: 'window',
        pos,
        width: grid.width,
        height: grid.height,
        sill: grid.from + row * (grid.height + grid.gap),
        lit,
        ...(grid.frame === undefined ? {} : { frame: grid.frame }),
        ...(lit && grid.glassLit !== undefined
          ? { glass: grid.glassLit }
          : grid.glass === undefined || lit
            ? {}
            : { glass: grid.glass }),
        seed: Math.floor(rng.next() * 1e6),
      })
    }
  return out
}
