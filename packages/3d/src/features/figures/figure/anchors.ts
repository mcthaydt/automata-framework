// Where a dressed figure's hands can go, and how far its arms hang out to clear it. The garments publish their openings
// (a pocket's mouth, a hem's side, the hip) as anchors; the stands place the hands against them, and the walk swings the
// arms clear of the body by the clearance. Changed: no `pendant` kind (the SNEKPRTY nameplate it marked is not taken).

import type { V3 } from '../../../shared/math/math.ts'
import type { Part } from '../body/mesh.ts'
import { reach } from '../body/reach.ts'
import { at, J, type Side, type Skeleton } from '../body/rig.ts'

/**
 * Where a hand can go on a dressed figure: `at` the opening's centre in rest figure space (as the garments'
 * parts are built), riding `bone`; `open` the unit direction a hand goes into it.
 */
export interface Anchor {
  kind: 'bellyPocket' | 'frontPocket' | 'thighPocket' | 'jacketPocket' | 'hem' | 'hip'
  side?: Side
  bone: number
  at: V3
  open: V3
}
export type AnchorKind = Anchor['kind']

const sideSign = (side: Side): number => (side === 'L' ? 1 : -1)

/**
 * The least each arm (L, R) hangs out from the body (rad) to clear the dressed figure: at each height the
 * hand passes, the outermost surface's width there (reach on every part but the arms' and those in `skip`),
 * against the hand's own round inward of the arm's axis and a little air. So the hands hang clear of whatever
 * is widest at the hip on any body; a sleeve may still lie over its own top's body above, as cloth does.
 */
export function clearance(
  s: Skeleton,
  parts: readonly Part[],
  arms: Readonly<Record<Side, number>>,
  skip: readonly number[] = [],
): [number, number] {
  const g = s.genes
  const k = g.height / 1.62
  const top = s.hipY + 0.03 * k
  const air = 0.002 * k
  const MAX = 0.6
  const body = parts.filter((p) => p.group !== arms.L && p.group !== arms.R && !skip.includes(p.group))
  const clear = (side: Side) => {
    const x = sideSign(side)
    const [ax, ay] = at(s.rest, J[`upperArm.${side}`])
    const own = parts.filter((p) => p.group === arms[side])
    // The body's width beside the arm, in 1 cm rows, its widest a little before, at and behind the middle.
    const rows = new Map<number, number>()
    const width = (y: number) => {
      const row = Math.round(y * 100)
      const known = rows.get(row)
      if (known !== undefined) return known
      const found = Math.max(
        ...[-0.04, 0, 0.04].map((z) => reach(body, s.rest, [0, row / 100, z * k], [x, 0, 0])),
      )
      rows.set(row, found)
      return found
    }
    // The arm's round inward of its axis, from the wrist down to the fingertips.
    const along = [g.arms - 0.03 * k, g.arms + 0.02 * k, g.arms + 0.06 * k, g.arms + 0.1 * k]
    const round = along.map((d) => reach(own, s.rest, [ax, ay - d, 0], [-x, 0, 0]))
    for (let out = 0; out < MAX; out += 0.01) {
      const ok = along.every((d, i) => {
        const y = ay - d * Math.cos(out)
        return y > top || Math.abs(ax) + d * Math.sin(out) - at(round, i) * Math.cos(out) - air >= width(y)
      })
      if (ok) return out
    }
    return MAX
  }
  return [clear('L'), clear('R')]
}
