// The doors in the 3D scene (DESIGN.md §6.5, §10; G3-r, GAME-3D.1f part 5): a closed door is a slab filling its
// doorway, and its marker says what opens it: a small-key door a keyhole plate on each face, the boss door a large
// plate, a clear-room door bars, a switch door a link drawn along the floor to its switch. An open door is not drawn.
// Presentation.
import type { Box3, View3dFactory } from '@mcthaydt/automata-render-pixi3d'
import { Q16 } from '@mcthaydt/automata-render-pixi3d/sim'
import { Container3D, CubeGeometry, FlatMaterial, Mesh3D } from '@pixi/3d'
import type { Area } from '../systems/index.ts'
import { areaOfPoint } from './pieces.ts'

type Lock = 'none' | 'small-key' | 'boss-key' | 'clear' | 'switch'

/** A door as the scene draws it: its box in plan (metres), its lock, and for a switch door its switch's place. */
export interface DoorDrawn {
  readonly minX: number
  readonly minZ: number
  readonly maxX: number
  readonly maxZ: number
  readonly lock: Lock
  readonly link?: { readonly x: number; readonly z: number } | undefined
}

/** One box of a door's drawing, in metres, with its role and colour. */
export interface DoorPart extends Box3 {
  readonly role: 'slab' | 'keyhole' | 'boss-plate' | 'bar' | 'link'
  readonly colour: number
}

/** The slab's height, under the 2.6 m ceiling (a lintel above it). */
const SLAB_HEIGHT = 2.2
/** A plate's centre height, and how far it stands proud of the slab's face. */
const PLATE_HEIGHT = 1.2
const PROUD = 0.04
/** Half the keyhole plate's side, and the boss plate's. */
const KEYHOLE_HALF = 0.15
const BOSS_HALF = 0.45
/** Half a bar's side, and half the link's width on the floor (a hair above it). */
const BAR_HALF = 0.05
const LINK_HALF = 0.05
const LINK_HEIGHT = 0.02

// Endesga 64, as the map's legend (screens/MapScreen.svelte): the slab dark wood, a keyhole's brass, the boss door's
// red, a clear door's iron bars, a switch's cyan.
const COLOURS = {
  slab: 0x733e39,
  keyhole: 0xfeae34,
  'boss-plate': 0xe43b44,
  bar: 0x8b9bb4,
  link: 0x2ce8f5,
} as const

const part = (role: DoorPart['role'], min: Box3['min'], max: Box3['max']): DoorPart => ({
  role,
  colour: COLOURS[role],
  min,
  max,
})

/** The boxes that draw `door` (G3-r): the slab, then its kind's marker. */
export function doorParts(door: DoorDrawn): DoorPart[] {
  const { minX, minZ, maxX, maxZ } = door
  const cx = (minX + maxX) / 2
  const cz = (minZ + maxZ) / 2
  const alongX = maxX - minX >= maxZ - minZ
  const slab = part('slab', [minX, 0, minZ], [maxX, SLAB_HEIGHT, maxZ])
  // A plate centred on each face of the slab, `half` a side, standing `PROUD` off it.
  const plates = (role: DoorPart['role'], half: number): DoorPart[] => {
    const [low, high] = [PLATE_HEIGHT - half, PLATE_HEIGHT + half]
    return alongX
      ? [
          part(role, [cx - half, low, minZ - PROUD], [cx + half, high, minZ]),
          part(role, [cx - half, low, maxZ], [cx + half, high, maxZ + PROUD]),
        ]
      : [
          part(role, [minX - PROUD, low, cz - half], [minX, high, cz + half]),
          part(role, [maxX, low, cz - half], [maxX + PROUD, high, cz + half]),
        ]
  }
  if (door.lock === 'small-key') return [slab, ...plates('keyhole', KEYHOLE_HALF)]
  if (door.lock === 'boss-key') return [slab, ...plates('boss-plate', BOSS_HALF)]
  if (door.lock === 'clear') {
    // Three bars at the quarters of the doorway, through the slab, floor to lintel.
    const span = alongX ? maxX - minX : maxZ - minZ
    return [
      slab,
      ...[0.25, 0.5, 0.75].map((at) => {
        const along = (alongX ? minX : minZ) + span * at
        return alongX
          ? part(
              'bar',
              [along - BAR_HALF, 0, minZ - BAR_HALF],
              [along + BAR_HALF, SLAB_HEIGHT, maxZ + BAR_HALF],
            )
          : part(
              'bar',
              [minX - BAR_HALF, 0, along - BAR_HALF],
              [maxX + BAR_HALF, SLAB_HEIGHT, along + BAR_HALF],
            )
      }),
    ]
  }
  if (door.lock === 'switch' && door.link !== undefined) {
    // From the door's foot along z to the switch's z, then along x to the switch.
    const { x, z } = door.link
    return [
      slab,
      part(
        'link',
        [cx - LINK_HALF, 0, Math.min(cz, z) - LINK_HALF],
        [cx + LINK_HALF, LINK_HEIGHT, Math.max(cz, z) + LINK_HALF],
      ),
      part(
        'link',
        [Math.min(cx, x) - LINK_HALF, 0, z - LINK_HALF],
        [Math.max(cx, x) + LINK_HALF, LINK_HEIGHT, z + LINK_HALF],
      ),
    ]
  }
  return [slab]
}

/**
 * The view of every `door` row in the world (main.ts registers it): its parts as flat boxes, hidden while the door is
 * open. The area is the one whose rooms hold the doorway; the lock and the switch's place come from the entity the
 * row names.
 */
export function doorView(areas: readonly Area[]): View3dFactory {
  return (row) => {
    const fields = row.components.door
    if (fields === undefined) return undefined
    const centre = {
      x: (Number(fields.minX) + Number(fields.maxX)) / 2 / Q16,
      z: (Number(fields.minZ) + Number(fields.maxZ)) / 2 / Q16,
    }
    const area = areaOfPoint(areas, centre.x, centre.z)
    const entity = area?.entities[Number(fields.piece ?? 0) - 1]
    if (area === undefined || entity === undefined) return undefined
    const named =
      entity.lock === 'switch' ? area.entities.find((other) => other.id === entity.switch) : undefined
    const node = new Container3D()
    for (const drawn of doorParts({
      minX: Number(fields.minX) / Q16,
      minZ: Number(fields.minZ) / Q16,
      maxX: Number(fields.maxX) / Q16,
      maxZ: Number(fields.maxZ) / Q16,
      lock: entity.lock as Lock,
      link: named === undefined ? undefined : { x: named.x / Q16, z: named.z / Q16 },
    })) {
      const [x0, y0, z0] = drawn.min
      const [x1, y1, z1] = drawn.max
      const mesh = new Mesh3D({
        geometry: new CubeGeometry({ width: x1 - x0, height: y1 - y0, depth: z1 - z0 }),
        material: new FlatMaterial({ baseColor: drawn.colour }),
      })
      mesh.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2)
      node.addChild(mesh)
    }
    node.visible = fields.open !== true
    return {
      container: node,
      update(curr) {
        node.visible = curr.door?.open !== true
      },
      destroy() {
        node.destroy({ children: true })
      },
    }
  }
}
