// One fixed Rapier box behind each span a walker cannot pass, as the original game built them: the
// box runs the edge's length and the span's height, and sits behind the face (away from the room), as deep as the
// wall's `thick`, or `WALL_THICK` for a wall of none. It is turned about y so its x axis runs along the wall: yaw is
// atan2(-dir.z, dir.x), and the quaternion's half-angle terms come from the direction by the half-angle identities, so
// no trigonometry is needed. Masses get no box: masonry above a portal would close it.

import { WALL_THICK } from '@automata/3d/level'
import { BodyKind, body3d, collider3d, transform3d } from '@automata/physics/3d'
import type { SimContext } from '@automata/sim'
import { loadSectorMap } from '../load-sector-map'
import type { Edge } from '../resolve'
import { resolvedMap } from '../resolved-map'
import type { SectorMap } from '../sector-map.schema'
import { SectorCollider } from './sector-collider.component'

/** The rotation about y that takes the x axis to the wall's direction. */
function yawQuaternion(dir: Edge['dir']): { qy: number; qw: number } {
  const qw = Math.sqrt(Math.max(0, (1 + dir.x) / 2))
  const half = Math.sqrt(Math.max(0, (1 - dir.x) / 2))
  // sin(yaw / 2) has the sign of yaw, which is the sign of -dir.z; a wall running due west (dir.z = 0) turns by π.
  return { qy: dir.z > 0 ? -half : half, qw }
}

/** Replaces the scene's map, as `loadSectorMap` does, and its collider boxes with the new map's. */
export function loadSectorMapWithColliders(ctx: SimContext, map: SectorMap): void {
  for (const old of ctx.query(SectorCollider)) ctx.despawn(old.sid)
  loadSectorMap(ctx, map)
  const resolved = resolvedMap(ctx)
  resolved.colliders.forEach((span, index) => {
    const edge = resolved.sectors[span.sector]?.loops[span.loop]?.[span.index] as Edge
    const depth = edge.thick > 0 ? edge.thick : WALL_THICK
    ctx.spawn(
      [SectorCollider, { index }],
      body3d(BodyKind.fixed),
      collider3d.cuboid(edge.length / 2, (span.y1 - span.y0) / 2, depth / 2),
      transform3d({
        x: (edge.a.x + edge.b.x) / 2 - (edge.normal.x * depth) / 2,
        y: (span.y0 + span.y1) / 2,
        z: (edge.a.z + edge.b.z) / 2 - (edge.normal.z * depth) / 2,
        ...yawQuaternion(edge.dir),
      }),
    )
  })
}
