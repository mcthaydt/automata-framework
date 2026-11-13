import { content } from 'virtual:automata/content'
import { createOccluders, drawWorld, PLAYER_HEIGHT } from '@automata/3d'
import { followLook } from '@automata/3d/camera-view'
import { Container3D, type Mesh3D } from '@pixi/3d'
import { describe, expect, it } from 'vitest'
import { playOf } from '#src/app/content.ts'
import { ADA_RADIUS } from '#src/features/ada/walk.system.ts'
import { LEVEL, WORLD } from '#src/features/room/room.ts'

// Ada is never hidden behind the room. For every room of the prologue, at places across its walkable floor and from 24 headings, the
// real world (`drawWorld`) and the real occluder rule (`createOccluders`, settled, with the game's sprite width) decide what is drawn;
// then a line from the eye to her head and to her chest must reach her through nothing still drawn whole. Computed from the scene's
// geometry, triangle by triangle, not from pixels. A bulkhead over the corridor's mouth stood over her from the hall's side before the
// builder gave a portal's faces their line (session 2 of the camera work, item a).

const PLAY = playOf(content)
const HEADINGS = Array.from({ length: 24 }, (_, i) => i * 15)
/** The points that must stay in sight: her head and her chest. Her waist may be behind a bed, a gurney or the counter she stands behind, as in any cut-away. */
const SIGHT = [PLAYER_HEIGHT, PLAYER_HEIGHT * 0.7]
const STEP = 0.75

type V3 = { x: number; y: number; z: number }

/** Whether the open segment `from → to` passes through the triangle `a b c` (Möller–Trumbore). */
function crosses(from: V3, to: V3, p: ArrayLike<number>, a: number, b: number, c: number): boolean {
  const d = [to.x - from.x, to.y - from.y, to.z - from.z] as const
  const e1 = [p[b]! - p[a]!, p[b + 1]! - p[a + 1]!, p[b + 2]! - p[a + 2]!] as const
  const e2 = [p[c]! - p[a]!, p[c + 1]! - p[a + 1]!, p[c + 2]! - p[a + 2]!] as const
  const q = [d[1] * e2[2] - d[2] * e2[1], d[2] * e2[0] - d[0] * e2[2], d[0] * e2[1] - d[1] * e2[0]] as const
  const det = e1[0] * q[0] + e1[1] * q[1] + e1[2] * q[2]
  if (Math.abs(det) < 1e-12) return false
  const s = [from.x - p[a]!, from.y - p[a + 1]!, from.z - p[a + 2]!] as const
  const u = (s[0] * q[0] + s[1] * q[1] + s[2] * q[2]) / det
  if (u < 0 || u > 1) return false
  const r = [s[1] * e1[2] - s[2] * e1[1], s[2] * e1[0] - s[0] * e1[2], s[0] * e1[1] - s[1] * e1[0]] as const
  const v = (d[0] * r[0] + d[1] * r[1] + d[2] * r[2]) / det
  if (v < 0 || u + v > 1) return false
  const t = (e2[0] * r[0] + e2[1] * r[1] + e2[2] * r[2]) / det
  // Her own surroundings within a few centimetres (the floor under her feet, a wall she leans on) are not in the way.
  return t > 1e-4 && t < 1 - 0.03
}

/** A room's floor height: a plane's `z` (the level's floors are flat). */
const floorOf = (floor: unknown): number =>
  typeof floor === 'number' ? floor : Number((floor as { z?: number } | undefined)?.z ?? 0)

/** Whether `[x, z]` is inside the plan polygon `corners`. */
function inside(
  corners: readonly (readonly [number, number, ...unknown[]])[],
  x: number,
  z: number,
): boolean {
  let within = false
  for (let i = 0, j = corners.length - 1; i < corners.length; j = i++) {
    const [xi, zi] = corners[i] as readonly [number, number]
    const [xj, zj] = corners[j] as readonly [number, number]
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) within = !within
  }
  return within
}

describe('Ada is in sight from every heading, in every room', () => {
  const parent = new Container3D()
  const occluders = createOccluders(parent)
  const world = drawWorld({ parent, occluders, colourOf: () => 0 }, WORLD.pieces, {
    props: WORLD.props,
    blockout: true,
  })
  const meshes = WORLD.pieces.flatMap((piece) => {
    const mesh = world.mesh(piece.id)
    if (mesh === undefined) return []
    const p = piece.mesh.positions
    const lo = [Infinity, Infinity, Infinity]
    const hi = [-Infinity, -Infinity, -Infinity]
    for (let i = 0; i < p.length; i++) {
      lo[i % 3] = Math.min(lo[i % 3]!, p[i]!)
      hi[i % 3] = Math.max(hi[i % 3]!, p[i]!)
    }
    return [{ piece, mesh: mesh as Mesh3D, lo, hi }]
  })
  /** Where her feet cannot be: inside a prop's footprint (she walks round them). */
  const blocked = (x: number, z: number): boolean =>
    meshes.some(
      ({ piece, lo, hi }) =>
        piece.part === 'prop' && lo[1]! < 1 && x > lo[0]! && x < hi[0]! && z > lo[2]! && z < hi[2]!,
    )

  for (const view of PLAY.views) {
    it(`${view.id}: nothing drawn whole stands between the eye and her head or chest`, () => {
      const rooms = LEVEL.sectors.filter((sector) => sector.view === view.id && floorOf(sector.floor) === 0)
      const places: [number, number][] = []
      const xs = rooms.flatMap((room) => room.corners.map((corner) => corner[0]))
      const zs = rooms.flatMap((room) => room.corners.map((corner) => corner[1]))
      for (let x = Math.min(...xs) + ADA_RADIUS; x <= Math.max(...xs) - ADA_RADIUS; x += STEP)
        for (let z = Math.min(...zs) + ADA_RADIUS; z <= Math.max(...zs) - ADA_RADIUS; z += STEP)
          if (rooms.some((room) => inside(room.corners, x, z)) && !blocked(x, z)) places.push([x, z])
      expect(places.length).toBeGreaterThan(4)
      const tilt = (view.tiltDeg * Math.PI) / 180
      const hidden: string[] = []
      for (const [x, z] of places)
        for (const heading of HEADINGS) {
          const feet = { x, y: 0, z }
          const look = followLook(view, feet, { x: 0, z: 0 })
          const back = view.distance * Math.cos(tilt)
          const h = (heading * Math.PI) / 180
          const eye = {
            x: look.x - Math.sin(h) * back,
            y: look.y + view.distance * Math.sin(tilt),
            z: look.z - Math.cos(h) * back,
          }
          occluders.reset()
          occluders.update({
            eye,
            look,
            feet,
            head: { x, y: PLAYER_HEIGHT, z },
            width: (PLAYER_HEIGHT * 24) / 124,
            seconds: 0,
            reduced: true,
          })
          for (const y of SIGHT) {
            const to = { x, y, z }
            for (const { piece, mesh, lo, hi } of meshes) {
              if (!mesh.visible || mesh.material.alpha < 1) continue
              if (Math.max(eye.x, to.x) < lo[0]! || Math.min(eye.x, to.x) > hi[0]!) continue
              if (Math.max(eye.y, to.y) < lo[1]! || Math.min(eye.y, to.y) > hi[1]!) continue
              if (Math.max(eye.z, to.z) < lo[2]! || Math.min(eye.z, to.z) > hi[2]!) continue
              const { positions: p, indices } = piece.mesh
              for (let t = 0; t < indices.length; t += 3)
                if (crosses(eye, to, p, indices[t]! * 3, indices[t + 1]! * 3, indices[t + 2]! * 3)) {
                  hidden.push(
                    `${x.toFixed(2)},${z.toFixed(2)} heading ${heading} y ${y.toFixed(2)}: ${piece.id}`,
                  )
                  break
                }
            }
          }
        }
      expect(hidden.slice(0, 12)).toEqual([])
    }, 120_000)
  }
})
