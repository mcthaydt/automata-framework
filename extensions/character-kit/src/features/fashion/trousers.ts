// Trouser legs for the runway's `jeans` and `trousers`: each leg grown a clearance or two, straight from the knee, with the options a pair may
// add (an outer seam, a waistband, a cropped hem, a turn-up). The shells' own machinery is `shells.ts`.
import {
  type Fit,
  GROUP,
  lerp,
  type Part,
  type Ring,
  smooth,
  type Wearing,
} from '../../shared/figures/door.ts'
import { grown, heights, legGroup, patch, SIDES, shell, skins } from './shells.ts'

/** Is a long tail (a skirt, dress or coat to below mid-thigh) in the outfit? Then the legs' shells start under it. */
const longTail = (c: Wearing) =>
  c.garments.some(
    (g) => ('skirt' in g || 'dress' in g || 'coat' in g) && ((g as { length?: number }).length ?? 0) > 0.3,
  )

/** What jeans (or trousers) may add to the cut: all of it off by default, so a pair that names none draws as it always did. */
interface LegDetail {
  /** A cloth for the outer seam: a thin strip down the outside of each leg, hip to hem. */
  readonly seam?: string
  /** A cloth for the waistband: a band round the waist, a little proud of the seat. */
  readonly waistband?: string
  /** How far the hem rises above the ankle, as a share of the shin's length (0, the default, ends at the ankle). */
  readonly crop?: number
  /** A cloth for a turn-up: the last 3.5 cm of each leg turned back on itself, a clearance proud of the leg. */
  readonly turn?: string
}

/**
 * Trouser legs: each leg grown `ease` clearances, straight from the knee down (`wide` widens them there), from the hip (or from
 * under a long tail) to the ankle; the seat and fly a shell of the torso from the belt down. `taper` (0 a straight pipe, 1 the leg's
 * own narrowing) draws the cloth in from the knee to the ankle, so a slim cut ends at a slim hem and not at the knee's width.
 * `gap` (0 the cloth clears the leg by `ease` all round, 1 the inside of each leg's cloth lies on the leg and only its outside keeps
 * the clearance) lets the floor show between two legs the cloth would otherwise join, from the crotch down to the knee and below.
 */
function legsOf(
  c: Wearing,
  material: string,
  ease: number,
  wide: number,
  taper = 0,
  gap = 0,
  more: LegDetail = {},
): Fit {
  const h = heights(c)
  const P = c.body.profiles
  const cl = c.body.clear
  const sk = skins(c)
  const off = ease * cl
  const parts: Part[] = []
  parts.push(
    shell(grown(P.torso, off), h.belt, -Infinity, material, GROUP.torso, sk.trunk, [
      0,
      P.torso.caps?.[1] ?? 0,
    ]),
  )
  const under = longTail(c)
  for (const [side, out] of SIDES) {
    const L = P.leg[side]
    const kneeR = c.body.at('leg', side, h.knee + 0.1 * h.k)
    // How far down the shin a ring is, 0 at the knee and 1 at the ankle: the taper's own measure.
    const down = (r: Ring) => Math.min(1, Math.max(0, (h.knee - r.y) / (h.knee - h.ankle)))
    const straight = (r: Ring): Partial<Ring> => {
      if (r.y >= h.knee + 0.1 * h.k) return {}
      const draw = taper * down(r)
      return {
        rx: lerp(Math.max(r.rx, kneeR.rx * wide), r.rx, draw) + off,
        rz: lerp(Math.max(r.rz, kneeR.rz * wide), r.rz, draw) + off,
      }
    }
    // The clearance the inside of this leg's cloth gives up, building from nothing at the hip to all of `gap` by the knee: the ring
    // narrows by half of it and moves out by the same half, so its outer edge stays where it was and its inner edge comes in.
    const trim = (r: Ring): number =>
      gap * off * smooth(Math.min(1, Math.max(0, (h.hipY - r.y) / (h.hipY - h.knee))))
    const cut = (r: Ring): Partial<Ring> => {
      const own = straight(r)
      const take = trim(r)
      if (take === 0) return own
      return { ...own, rx: (own.rx ?? r.rx + off) - take / 2, dx: (r.dx ?? 0) + (out * take) / 2 }
    }
    const hem = h.ankle + 0.025 * h.k + (more.crop ?? 0) * (h.knee - h.ankle)
    parts.push(
      shell(
        grown(L, off, cut),
        under ? h.knee + 0.03 * h.k : Infinity,
        hem,
        material,
        legGroup(side),
        sk.leg(side),
        [under ? 0 : (L.caps?.[0] ?? 0), 0],
      ),
    )
    if (more.turn !== undefined) {
      const extra = 1.3 * cl
      parts.push(
        shell(
          grown(L, off + extra, (r) => {
            const own = cut(r)
            return { ...own, rx: (own.rx ?? r.rx + off) + extra, rz: (own.rz ?? r.rz + off) + extra }
          }),
          hem + 0.035 * h.k,
          hem - 0.004 * h.k,
          more.turn,
          legGroup(side),
          sk.leg(side),
          [0, 0],
        ),
      )
    }
    // The outer seam: the faces of the leg's own shell that face straight out, a few millimetres wide, hip to hem.
    if (more.seam !== undefined)
      parts.push(
        patch(
          c,
          more.seam,
          off + 0.4 * cl,
          h.hipY - 0.02 * h.k,
          hem + 0.01 * h.k,
          (x, y, z) => {
            const ring = c.body.at('leg', side, y)
            return out * (x - (ring.dx ?? 0)) > ring.rx * 0.5 && Math.abs(z - (ring.dz ?? 0)) < 0.012 * h.k
          },
          { profile: L, group: legGroup(side), skin: sk.leg(side) },
        ),
      )
  }
  // The waistband: a belt's width of the jeans' own waist, in a cloth of its own, a little proud of the seat.
  if (more.waistband !== undefined)
    parts.push(
      shell(
        grown(P.torso, off + 0.7 * cl),
        h.belt + 0.012 * h.k,
        h.belt - 0.028 * h.k,
        more.waistband,
        GROUP.torso,
        sk.trunk,
        [0, 0],
      ),
    )
  // A cropped hem leaves the shin under it bare: its region is not painted in the jeans' cloth, so the ankle shows skin below the turn-up.
  const shin = (more.crop ?? 0) > 0 ? {} : { shin: material }
  return { parts, paint: { pelvis: material, thigh: material, knee: material, ...shin } }
}

export { legsOf }
