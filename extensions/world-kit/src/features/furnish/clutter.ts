// Layers 3 to 5: clutter on the surfaces props offer, litter on the floor by the room's grime, and the ceiling's lamps.
//
// Ported from EnvironmentBuilder (mcthaydt/EnvironmentBuilder) src/features/world/dress.ts at 6d82a52
// (`surfaceClutter`, `floorClutter`, `ceilingFixtures`).
import { heightAt, inside, ringsOf, type V2 } from '@automata/3d/props-kit'
import { type Ctx, fits, footprintOf, place } from './context.ts'
import { ceilingOf } from './fixtures.ts'
import { centroidOf, mm, overlaps, type Rect, type Spot, turned } from './floor-plan.ts'

/** The room's props so far: those placed by hand inside it and what the layers have placed. */
const propsIn = (c: Ctx) => [
  ...(c.level.props ?? []).filter((p) => inside(c.poly, p.at[0] as number, p.at[1] as number)),
  ...c.out,
]

/**
 * Items on every surface a prop offers (a table, a shelf, a counter, a filing cabinet): `clutter.per` per square metre
 * of it, at most six, on random points of its top less a 0.05 m margin, none on another, turned with the prop, at the
 * top's height.
 */
export function surfaceClutter(c: Ctx): void {
  const kit = c.kit.clutter
  if (kit === undefined) return
  for (const parent of propsIn(c)) {
    if (parent.use === undefined) continue
    const top = footprintOf(c.library, { use: parent.use, with: parent.with }).top
    if (top === undefined) continue
    const count = Math.min(6, Math.round(top.size[0] * top.size[1] * c.density * kit.per))
    const angle = parent.angle ?? 90
    const a = (angle * Math.PI) / 180
    const front: V2 = [Math.cos(a), Math.sin(a)]
    const right: V2 = [Math.sin(a), -Math.cos(a)]
    const placed: Rect[] = []
    for (let k = 0; k < count; k++) {
      const use = kit.on[Math.floor(c.next() * kit.on.length)] as string
      const fp = footprintOf(c.library, { use })
      const hx = top.size[0] / 2 - 0.05 - fp.w / 2
      const hz = top.size[1] / 2 - 0.05 - fp.d / 2
      if (hx <= 0 || hz <= 0) continue
      for (let tries = 0; tries < 10; tries++) {
        const ox = (c.next() * 2 - 1) * hx
        const oz = (c.next() * 2 - 1) * hz
        const rect: Rect = [ox - fp.w / 2, oz - fp.d / 2, ox + fp.w / 2, oz + fp.d / 2]
        if (placed.some((q) => overlaps(rect, q, 0))) continue
        placed.push(rect)
        const [px, pz] = parent.at as [number, number]
        const base = parent.at[2] ?? heightAt(c.sector.floor, ringsOf(c.sector)[0]?.[0] as V2, px, pz)
        place(c, 'clutter', {
          use,
          at: [mm(px + right[0] * ox + front[0] * oz), mm(pz + right[1] * ox + front[1] * oz), base + top.y],
          angle,
        })
        break
      }
    }
  }
}

/**
 * Litter on the floor by the room's grime (0 none … 2 derelict; the dress's own, 0.6 by default): `floor.per` per
 * square metre of floor, each on a random free point (40 tries), at a random angle; nothing on anything else.
 */
export function floorClutter(c: Ctx): void {
  const kit = c.kit.floor
  const grime = c.dress.grime ?? 0.6
  if (kit === undefined) return
  const xs = c.poly.map((p) => p[0])
  const zs = c.poly.map((p) => p[1])
  const count = Math.round(c.area * grime * c.density * kit.per)
  for (let k = 0; k < count; k++) {
    const use = kit.use[Math.floor(c.next() * kit.use.length)] as string
    const f = footprintOf(c.library, { use })
    for (let tries = 0; tries < 40; tries++) {
      const spot: Spot = {
        at: [
          Math.min(...xs) + c.next() * (Math.max(...xs) - Math.min(...xs)),
          Math.min(...zs) + c.next() * (Math.max(...zs) - Math.min(...zs)),
        ],
        angle: Math.round(c.next() * 360),
      }
      if (!fits(c, spot, f.w, f.d)) continue
      place(
        c,
        'floor',
        { use, at: [mm(spot.at[0]), mm(spot.at[1])], angle: spot.angle },
        turned(spot.at, f.w, f.d, spot.angle).rect,
      )
      break
    }
  }
}

/**
 * Ceiling lamps on a grid over the room's bounds: along each axis `floor(length / spacing)` points (at least one),
 * `spacing` apart, centred; those inside the room (the centroid if none). None under a sky, or where a lamp stands
 * already.
 */
export function ceilingFixtures(c: Ctx): void {
  const kit = c.kit.ceiling
  if (kit === undefined || c.sector.ceiling.sky === true) return
  if (kit.skipIfLamp === true && propsIn(c).some((p) => p.use?.startsWith('lamp.') === true)) return
  const xs = c.poly.map((p) => p[0])
  const zs = c.poly.map((p) => p[1])
  const along = (lo: number, hi: number): number[] => {
    const n = Math.max(1, Math.floor((hi - lo) / kit.spacing))
    return Array.from({ length: n }, (_, i) => (lo + hi) / 2 + (i - (n - 1) / 2) * kit.spacing)
  }
  let points = along(Math.min(...xs), Math.max(...xs))
    .flatMap((x) => along(Math.min(...zs), Math.max(...zs)).map((z): V2 => [x, z]))
    .filter((p) => inside(c.poly, p[0], p[1]))
  if (points.length === 0) points = [centroidOf(c.poly)]
  const h = ceilingOf(c)
  for (const p of points)
    place(c, 'ceiling', {
      use: kit.use,
      at: [mm(p[0]), mm(p[1])],
      with: { height: h - (kit.drop ?? 0.45), ceiling: h },
    })
}
