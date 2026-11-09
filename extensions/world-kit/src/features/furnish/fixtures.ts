// Layer 2: wall fixtures. By each door and doorway a sign over it, a switch beside it with its conduit up to the
// ceiling; outlets along the free walls, vents high on the long ones, radiators under the windows, art every few
// metres, and outdoors the kit's list. Everything hung keeps clear of the wall's windows and doors and of what already
// hangs; nothing is hung behind furniture where it would not be seen.
//
// Ported from the world generator this kit grew out of (`hang`,
// `standOn`, `fixtures`). Changed: nothing is kept out of a diorama (a level is built whole).
import { heightAt, inward, ringsOf, type Segment, type V2 } from '@automata/3d/props-kit'
import {
  alongSeg,
  type Ctx,
  featuresOf,
  fits,
  footprintOf,
  lengthOf,
  place,
  solidSegs,
  spanOfSeg,
  wallKey,
} from './context.ts'
import { angleOf, atSpot, mm, overlaps, type Spot, turned } from './floor-plan.ts'

interface Taken {
  p0: number
  p1: number
  y0: number
  y1: number
}

/** The spans of a wall's features (windows, doors, shops, signs: 0.1 m either side) and the heights each takes. */
function featureSpans(c: Ctx, g: Segment): Taken[] {
  const [lo, hi] = spanOfSeg(g)
  return featuresOf(c, g)
    .filter((d) => d.pos >= lo - 1e-6 && d.pos <= hi + 1e-6)
    .map((d) => ({
      p0: d.pos - d.width / 2 - 0.1,
      p1: d.pos + d.width / 2 + 0.1,
      y0: d.kind === 'window' ? (d.sill ?? 0.9) - 0.05 : -1,
      y1: d.kind === 'window' ? (d.sill ?? 0.9) + (d.height ?? 1.2) + 0.05 : 99,
    }))
}

/**
 * Whether a span of a wall, over some heights, is free: on the segment (or, `overhang`, on its edge: a sign wider than
 * the doorway it hangs over), clear of its features and of what already hangs.
 */
function free(c: Ctx, g: Segment, p0: number, p1: number, y0: number, y1: number, overhang = false): boolean {
  const onEdge = c.segs.filter((x) => wallKey(x) === wallKey(g)).map(spanOfSeg)
  const [lo, hi] = overhang
    ? [Math.min(...onEdge.map((e) => e[0])), Math.max(...onEdge.map((e) => e[1]))]
    : spanOfSeg(g)
  const clash = (a: Taken): boolean => p0 < a.p1 && p1 > a.p0 && y0 < a.y1 && y1 > a.y0
  return (
    p0 >= lo - 1e-6 &&
    p1 <= hi + 1e-6 &&
    !featureSpans(c, g).some(clash) &&
    !c.hung.filter((h) => h.wall === wallKey(g)).some(clash)
  )
}

/** The wall's free spans: the segment less its low features (0.1 m either side), as [from, to] along the wall. */
function freeSpans(c: Ctx, g: Segment): [number, number][] {
  let spans: [number, number][] = [spanOfSeg(g)]
  for (const d of featureSpans(c, g).filter((s) => s.y0 < 0.5))
    spans = spans.flatMap(([a, b]): [number, number][] =>
      d.p1 <= a || d.p0 >= b
        ? [[a, b]]
        : (
            [
              [a, Math.min(b, d.p0)],
              [Math.max(a, d.p1), b],
            ] as [number, number][]
          ).filter(([x, y]) => y - x > 0.01),
    )
  return spans
}

/**
 * Hangs `use` on wall segment `g` at `p` (the wall's coordinate), its base `h0` metres over the floor, if the span is
 * free (and, with `clear`, nothing stands before it). 0.01 m off the wall, facing in. Returns whether it hung.
 */
function hang(
  c: Ctx,
  g: Segment,
  use: string,
  p: number,
  h0: number,
  params?: Record<string, unknown>,
  clear = false,
  overhang = false,
): boolean {
  const f = footprintOf(c.library, { use, with: params })
  const point = alongSeg(g, p)
  if (point === null || !free(c, g, p - f.w / 2, p + f.w / 2, h0, h0 + f.h, overhang)) return false
  const n = inward(c.level, g)
  const angle = angleOf(n[0], n[1])
  if (
    clear &&
    c.occupied.some((o) =>
      overlaps(turned([point[0] + n[0] * 0.05, point[1] + n[1] * 0.05], f.w, 0.1, angle).rect, o),
    )
  )
    return false
  place(c, 'fixture', {
    use,
    ...(params === undefined ? {} : { with: params }),
    at: [mm(point[0] + n[0] * 0.01), mm(point[1] + n[1] * 0.01), floorUnder(c, point) + h0],
    angle,
  })
  c.hung.push({ wall: wallKey(g), p0: p - f.w / 2, p1: p + f.w / 2, y0: h0, y1: h0 + f.h })
  return true
}

/** The floor's height under a point of the room. */
function floorUnder(c: Ctx, point: V2): number {
  return heightAt(c.sector.floor, ringsOf(c.sector)[0]?.[0] as V2, point[0], point[1])
}

/** Stands a floor piece against a wall segment at `p` (a radiator, a utility box), facing in, if it fits. */
function standOn(c: Ctx, g: Segment, use: string, p: number, params?: Record<string, unknown>): boolean {
  const f = footprintOf(c.library, { use, with: params })
  const point = alongSeg(g, p)
  if (point === null) return false
  const n = inward(c.level, g)
  const spot: Spot = {
    at: [point[0] + n[0] * (f.d / 2 + 0.01), point[1] + n[1] * (f.d / 2 + 0.01)],
    angle: angleOf(n[0], n[1]),
  }
  if (!fits(c, spot, f.w, f.d)) return false
  place(
    c,
    'fixture',
    { use, ...(params === undefined ? {} : { with: params }), at: atSpot(spot), angle: spot.angle },
    turned(spot.at, f.w, f.d, spot.angle).rect,
  )
  return true
}

/** The room's ceiling over its floor (a sky ceiling's height counts too). */
export function ceilingOf(c: Ctx): number {
  const origin = ringsOf(c.sector)[0]?.[0] as V2
  return heightAt(c.sector.ceiling, origin, origin[0], origin[1]) - c.floor
}

/** The wall fixtures layer. */
export function fixtures(c: Ctx): void {
  const fx = c.kit.fixtures
  const solid = solidSegs(c)
  const top = ceilingOf(c)
  const every = fx.artEvery ?? 3
  const sky = c.sector.ceiling.sky === true

  // By each doorway and door: over the opening a sign, if there is room; and on the wall beside it a switch (its far
  // end first, then its near), at 1.22 m, with a conduit up to the ceiling (or to the sign's base, where they share a
  // span).
  if (fx.switches === true) {
    const openings: { g: Segment; lo: number; hi: number; top: number }[] = []
    for (const g of c.segs) {
      if (g.next >= 0) {
        const next = c.level.sectors[g.next]
        const [lo, hi] = spanOfSeg(g)
        const nextOrigin = ringsOf(next as NonNullable<typeof next>)[0]?.[0] as V2
        openings.push({
          g,
          lo,
          hi,
          top: Math.min(
            top,
            heightAt((next as NonNullable<typeof next>).ceiling, nextOrigin, g.a[0], g.a[1]) - c.floor,
          ),
        })
      } else
        for (const d of featuresOf(c, g))
          if (d.kind === 'door' && alongSeg(g, d.pos) !== null)
            openings.push({ g, lo: d.pos - d.width / 2, hi: d.pos + d.width / 2, top: d.height ?? 2.1 })
    }
    for (const o of openings) {
      const along = solid.filter((h) => wallKey(h) === wallKey(o.g))
      const cap = sky ? 3.55 : top
      // The sign first: it is the widest, and the switch and conduit are fitted round it. Its words: the kit's (a
      // waiting room's door reads EXIT or OFFICE, not a shop's name), else a made-up name.
      const seed = (c.dress.seed ?? 1) * 13 + (c.counts.fixture ?? 0)
      const words = Array.isArray(fx.signs) && fx.signs.length > 0 ? (fx.signs as string[]) : null
      const hung =
        fx.signs !== undefined &&
        fx.signs !== false &&
        hang(
          c,
          o.g,
          'sign.cream',
          (o.lo + o.hi) / 2,
          o.top + 0.26,
          { seed, ...(words === null ? {} : { text: [words[seed % words.length]] }) },
          false,
          true,
        )
      const sign = hung ? c.hung[c.hung.length - 1] : undefined
      for (const q of [o.hi + 0.07 + 0.16, o.lo - 0.07 - 0.16]) {
        const wall = along.find((x) => alongSeg(x, q) !== null)
        if (wall !== undefined && hang(c, wall, 'fixture.switch', q, 1.22)) {
          // The conduit rises from behind the switch: its own plate does not block it.
          const plate = c.hung.pop()
          const w = footprintOf(c.library, { use: 'fixture.conduit' }).w
          const stop = sign !== undefined && q + w / 2 > sign.p0 && q - w / 2 < sign.p1 ? sign.y0 : cap
          hang(c, wall, 'fixture.conduit', q, 1.28, { height: stop - 1.28 })
          if (plate !== undefined) c.hung.push(plate)
          break
        }
      }
    }
  }
  // Outlets: along each free span, every 2.6 m, at 0.32 m (not behind furniture).
  if (fx.outlets === true)
    for (const g of solid)
      for (const [s0, s1] of freeSpans(c, g)) {
        if (s1 - s0 <= 1.2) continue
        const count = Math.floor((s1 - s0 - 1) / 2.6)
        for (let k = 0; k <= count; k++)
          hang(
            c,
            g,
            'fixture.outlet',
            s0 + 0.5 + (count > 0 ? ((s1 - s0 - 1) * k) / count : (s1 - s0 - 1) * 0.35),
            0.32,
            undefined,
            true,
          )
      }
  // Vents: one on each wall over 2.4 m, high, at the first free of three places along it.
  if (fx.vents === true)
    for (const g of solid) {
      if (lengthOf(g) <= 2.4) continue
      const [lo, hi] = spanOfSeg(g)
      for (const u of [0.62, 0.3, 0.8])
        if (hang(c, g, 'fixture.vent', lo + (hi - lo) * u, Math.min(top - 0.45, 2.95))) break
    }
  // Radiators under each window, on the floor.
  if (fx.radiators === true)
    for (const g of solid)
      for (const d of featuresOf(c, g))
        if (d.kind === 'window' && alongSeg(g, d.pos) !== null)
          standOn(c, g, 'radiator', d.pos, { width: Math.min(1, d.width) })
  // Art along each free span, every `artEvery` m, the listed presets in turn, centred at 1.45 m.
  if (fx.art !== undefined && fx.art.length > 0) {
    let k = 0
    for (const g of solid)
      for (const [s0, s1] of freeSpans(c, g))
        for (let p = s0 + every / 2; p <= s1 - 0.2; p += every) {
          const use = fx.art[k % fx.art.length] as string
          if (hang(c, g, use, p, 1.45 - footprintOf(c.library, { use }).h / 2, undefined, true)) k++
        }
  }
  // Outdoors: the listed presets along each solid wall, every `artEvery` m, in turn: a cable run up at 2.6 m, a utility
  // box on the ground against the wall.
  if (fx.outdoor !== undefined && fx.outdoor.length > 0) {
    let k = 0
    for (const g of solid) {
      const [lo, hi] = spanOfSeg(g)
      for (let p = lo + every / 2; p <= hi - 0.2; p += every) {
        const use = fx.outdoor[k % fx.outdoor.length] as string
        if (use === 'box.utility' ? standOn(c, g, use, p) : hang(c, g, use, p, 2.6, { length: 2 })) k++
      }
    }
  }
}
