// The clinic fixture for nav's tests, in Node and the browsers (`?raw`, no `node:fs`): sectors' clinic level,
// the clinic's nav graph, and its boxes behind a game-side `Blocked` like the original's (boxes are the game's, not nav's).

import {
  blockedBy,
  type Point,
  type ResolvedMap,
  readSectorMap,
  resolveLevel,
  type SectorMap,
} from '@automata/sectors/sim'
import clinicLevel from '@automata/sectors/testing/fixtures/clinic.af-sector.json?raw'
import { parse } from 'smol-toml'
import type { NavGraph } from '../shared/sim/nav-graph.schema'
import type { Blocked } from '../shared/sim/route'
import boxesToml from './fixtures/clinic.boxes.toml?raw'
import graphToml from './fixtures/clinic.nav-graph.toml?raw'

export const clinicMap = (): SectorMap => readSectorMap(JSON.parse(clinicLevel)).level
export const clinicGraph = (): NavGraph => parse(graphToml) as unknown as NavGraph

interface Box {
  readonly id: string
  readonly x: number
  readonly z: number
  readonly w: number
  readonly d: number
  readonly kind: string
}
const boxes = (parse(boxesToml) as unknown as { boxes: Box[] }).boxes

/** Liang–Barsky clip of segment a→b against a box footprint grown by `margin` (the original's `segmentHitsBox`). */
function segmentHitsBox(a: Point, b: Point, box: Box, margin: number): boolean {
  let near = 0
  let far = 1
  const axes = [
    [a.x, b.x - a.x, box.x, box.w / 2 + margin],
    [a.z, b.z - a.z, box.z, box.d / 2 + margin],
  ] as const
  for (const [start, delta, center, half] of axes) {
    if (Math.abs(delta) < 1e-9) {
      if (start < center - half || start > center + half) return false
      continue
    }
    const t1 = (center - half - start) / delta
    const t2 = (center + half - start) / delta
    near = Math.max(near, Math.min(t1, t2))
    far = Math.min(far, Math.max(t1, t2))
    if (near > far) return false
  }
  return true
}
const inside = (p: Point, box: Box, margin: number): boolean =>
  Math.abs(p.x - box.x) <= box.w / 2 + margin && Math.abs(p.z - box.z) <= box.d / 2 + margin

/**
 * The clinic's walls (sectors) and boxes: an exit always blocks, a door while it is shut, furniture always. For sight
 * (`furniture: false`) furniture does not block, as the original's `wallsOnly` line of sight.
 */
export function clinicBlocked(
  map: ResolvedMap,
  doors: Readonly<Record<string, boolean>>,
  { furniture = true }: { readonly furniture?: boolean } = {},
): Blocked {
  const walls = blockedBy(map, doors)
  const blocks = (box: Box): boolean =>
    box.kind === 'exit' || (box.kind === 'door' ? doors[box.id] !== true : furniture)
  return {
    open: walls.open,
    segment: (a, b, margin) =>
      walls.segment(a, b, margin) ||
      boxes.some(
        (box) =>
          blocks(box) &&
          !(inside(a, box, margin) || inside(b, box, margin)) &&
          segmentHitsBox(a, b, box, margin),
      ),
  }
}

export const resolvedClinic = (): ResolvedMap => resolveLevel(clinicMap())
