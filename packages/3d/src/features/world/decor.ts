// What a wall carries and what a doorway holds: a window, a door, a shopfront, each authored in the wall's own frame
// (x along it, y up, z out into the room), and a doorway sector's hinged door.
//
// Ported from EnvironmentBuilder (mcthaydt/EnvironmentBuilder) src/features/world/map.ts at 6d82a52 (`decorPieces`,
// `doorPieces`). Changed: the rng is AF's seeded one, a piece names its swatch for the library to check, and a door
// carries its hinge and its swing for the stage to turn it (it is built shut). A sign is lettered by the props'
// generators, which task 7.3 ports; until then a sign draws nothing.
import { createRng } from '@automata/sim'
import type { AfSectorEntry2, Decor, SectorDoor } from '../../shared/level/af-sector-2.schema.ts'
import { type MeshData, merge, tube } from '../../shared/math/geometry.ts'
import type { V3 } from '../../shared/math/math.ts'
import { box, quad } from './mesh.ts'
import { at, rotateY } from './plane-mesh.ts'
import { heightAt, type V2 } from './sectors.ts'

/** A piece before the builder places it: its swatch, a name for its place among its siblings, and its mesh. */
export interface RawPiece {
  readonly mesh: MeshData
  readonly material: string
  readonly role: string
}

const DOOR_HEIGHT = 2.05
const WINDOW_HEIGHT = 1.2
const WINDOW_SILL = 0.95

/** The pieces a window, a door or a shopfront makes on its wall, in the wall's frame. */
export function decorPieces(decor: Decor, night: boolean, wallTrim: string, interiors = true): RawPiece[] {
  if (decor.kind === 'sign') return []
  const rng = createRng(decor.seed ?? Math.round(decor.pos * 97 + decor.width * 13))
  const out: RawPiece[] = []
  const frame = decor.frame ?? wallTrim
  const w = decor.width
  const h = decor.height ?? (decor.kind === 'door' ? DOOR_HEIGHT : WINDOW_HEIGHT)
  const sill = decor.sill ?? (decor.kind === 'door' ? 0 : WINDOW_SILL)
  if (decor.kind === 'door') {
    const wood = decor.swatch ?? 'doorWood'
    out.push({ mesh: box([0, 0, 0.02], [w, h, 0.04]), material: wood, role: 'door' })
    out.push({
      mesh: merge(
        box([0, h * 0.55, 0.045], [w * 0.7, h * 0.33, 0.012]),
        box([0, h * 0.1, 0.045], [w * 0.7, h * 0.33, 0.012]),
      ),
      material: wood,
      role: 'doorPanels',
    })
    out.push({
      mesh: merge(
        box([-w / 2 - 0.04, 0, 0.03], [0.08, h + 0.08, 0.06]),
        box([w / 2 + 0.04, 0, 0.03], [0.08, h + 0.08, 0.06]),
        box([0, h, 0.03], [w + 0.16, 0.08, 0.06]),
      ),
      material: frame,
      role: 'doorFrame',
    })
    out.push({ mesh: box([w * 0.36, 0.98, 0.06], [0.05, 0.05, 0.04]), material: 'brass', role: 'knob' })
    return out
  }
  const lit = decor.lit ?? night
  const shop = decor.kind === 'shop'
  const glass = lit ? (decor.glass ?? 'windowLit') : (decor.glass ?? (night ? 'windowDark' : 'glassDay'))
  out.push({ mesh: quad([-w / 2, sill, 0.004], [w, 0, 0], [0, h, 0], 2, 2), material: glass, role: 'glass' })
  // The interior, lit from inside: drawn just in front of the glass, in its own glowing tones. The draw is made
  // whether or not it is used, so a window's other choices do not move when `interiors` is switched.
  const kinds = ['curtains', 'blinds', 'plant', 'figure', 'lamp', 'none'] as const
  const picked = kinds[rng.int(kinds.length)] as (typeof kinds)[number]
  const interior = lit && interiors ? (decor.interior ?? picked) : 'none'
  if (interior === 'curtains')
    for (const side of [-1, 1])
      out.push({
        mesh: tube([sill + h, w * 0.14, 0.02, 0.012], [sill + 0.02, w * 0.17, 0.025, 0.012], {
          x: side * (w / 2 - w * 0.15),
          arc: [0, Math.PI],
          folds: [7, 0.25],
          seg: 14,
          rings: 4,
        }),
        material: 'curtainLit',
        role: `curtain${side}`,
      })
  if (interior === 'blinds') {
    const slats: MeshData[] = []
    for (let y = sill + h * 0.35; y < sill + h - 0.04; y += 0.09)
      slats.push(box([0, y, 0.008], [w - 0.02, 0.04, 0.004]))
    out.push({ mesh: merge(...slats), material: 'blindsLit', role: 'blinds' })
  }
  if (interior === 'plant')
    out.push({
      mesh: merge(
        box([w * 0.25, sill, 0.008], [0.16, 0.16, 0.004]),
        ...[0, 1, 2, 3, 4].map((i) =>
          box([w * 0.25 + (i - 2) * 0.05, sill + 0.16, 0.009], [0.035, 0.18 + rng.next() * 0.2, 0.004]),
        ),
      ),
      material: 'silhouette',
      role: 'interior',
    })
  if (interior === 'figure')
    out.push({
      mesh: merge(
        box([-w * 0.15, sill, 0.008], [0.3, Math.min(h * 0.55, 0.6), 0.004]),
        box([-w * 0.15, sill + Math.min(h * 0.55, 0.6), 0.008], [0.16, 0.18, 0.004]),
      ),
      material: 'silhouette',
      role: 'interior',
    })
  if (interior === 'lamp')
    out.push({
      mesh: merge(
        box([w * 0.2, sill + h * 0.55, 0.008], [0.22, 0.14, 0.004]),
        box([w * 0.2, sill, 0.008], [0.03, h * 0.55, 0.004]),
      ),
      material: 'bulbWarm',
      role: 'interiorLamp',
    })
  // The frame round it, its cross bars (not on a shopfront), a sill.
  const f = 0.07
  out.push({
    mesh: merge(
      box([-w / 2 - f / 2, sill - f, 0.03], [f, h + 2 * f, 0.06]),
      box([w / 2 + f / 2, sill - f, 0.03], [f, h + 2 * f, 0.06]),
      box([0, sill + h, 0.03], [w + 2 * f, f, 0.06]),
    ),
    material: frame,
    role: 'frame',
  })
  if (!shop)
    out.push({
      mesh: merge(
        box([0, sill, 0.02], [0.035, h, 0.03]),
        box([0, sill + h / 2 - 0.017, 0.02], [w, 0.035, 0.03]),
      ),
      material: frame,
      role: 'bars',
    })
  out.push({ mesh: box([0, sill - 0.06, 0.06], [w + 0.24, 0.05, 0.12]), material: frame, role: 'sill' })
  if (shop && decor.awning)
    out.push({
      mesh: merge(
        quad([w / 2 + 0.3, sill + h + 0.55, 0], [-w - 0.6, 0, 0], [0, -0.42, 1.0], 3, 2),
        quad([w / 2 + 0.3, sill + h + 0.13, 1.0], [-w - 0.6, 0, 0], [0, -0.25, 0]),
      ),
      material: decor.awning,
      role: 'awning',
    })
  return out
}

/** The degrees a door swings fully open. */
export const DOOR_SWING = 88

/** A hinged door's pieces, shut: the swing and hinge say how the stage turns them (`open` 0 shut … 1 open). */
export interface DoorPiece extends RawPiece {
  readonly hinge: V3
  /** Signed degrees about y at the hinge when fully open. */
  readonly swing: number
}

/**
 * A doorway sector's hinged door: its panel across the doorway at its middle, two raised panels on each face and a
 * handle on each side by the edge away from the hinge. Built shut; `hinge` and `swing` turn it.
 */
export function doorPieces(sector: AfSectorEntry2, outline: readonly V2[], door: SectorDoor): DoorPiece[] {
  const xs = outline.map((p) => p[0])
  const zs = outline.map((p) => p[1])
  const [x0, x1, z0, z1] = [Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)]
  const alongX = x1 - x0 >= z1 - z0
  const length = (alongX ? x1 - x0 : z1 - z0) - 0.02
  const floor = heightAt(sector.floor, outline[0] as V2, (x0 + x1) / 2, (z0 + z1) / 2)
  const height = sector.ceiling.z - sector.floor.z - 0.02
  const atEnd = door.hinge === 'end'
  const into = door.into ?? -1
  const hinge = alongX
    ? at(atEnd ? x1 - 0.01 : x0 + 0.01, (z0 + z1) / 2, floor)
    : at((x0 + x1) / 2, atEnd ? z1 - 0.01 : z0 + 0.01, floor)
  // Built along +x from the hinge (mirrored for a hinge at the far end), then turned into place.
  const dir = atEnd ? -1 : 1
  const slab = box([(dir * length) / 2, 0, 0], [length, height, 0.045])
  const raised = merge(
    ...[-1, 1].flatMap((f) => [
      box([(dir * length) / 2, height * 0.08, f * 0.026], [length * 0.62, height * 0.36, 0.008]),
      box([(dir * length) / 2, height * 0.54, f * 0.026], [length * 0.62, height * 0.36, 0.008]),
    ]),
  )
  const handle = merge(
    ...[-1, 1].map((f) =>
      merge(
        box([dir * (length - 0.09), height * 0.47, f * 0.04], [0.025, 0.025, 0.04]),
        box([dir * (length - 0.13), height * 0.47, f * 0.065], [0.11, 0.02, 0.02]),
      ),
    ),
  )
  const closedTurn = alongX ? 0 : -90
  const swing = (alongX ? -into : into) * dir * DOOR_SWING
  const wood = door.surface
  const woodName = typeof wood === 'string' ? wood : (wood?.tile ?? 'doorWood')
  const place = (mesh: MeshData): MeshData => rotateY(mesh, closedTurn, hinge)
  return [
    { mesh: place(slab), material: woodName, role: 'doorPanel', hinge, swing },
    { mesh: place(raised), material: woodName, role: 'doorRaised', hinge, swing },
    { mesh: place(handle), material: door.handle ?? 'brass', role: 'doorHandle', hinge, swing },
  ]
}
