// The dungeon pieces in the 3D scene as placeholder boxes (GAME-3D.1i): a row view per piece component, drawn from
// the row's own box so a block that is pushed or a chest that opens follows the sim. Presentation only; the art
// (models, animation) is GAME-3D.1j's. The sim's rows carry no area, so a piece's area is the one whose rooms hold it.
import type { Box3, View3dFactory } from '@mcthaydt/automata-render-pixi3d'
import { Q16 } from '@mcthaydt/automata-render-pixi3d/sim'
import { Container3D, CubeGeometry, FlatMaterial, Mesh3D } from '@pixi/3d'

/** One piece's box in metres, its colour (Endesga 64, as the doors') and whether it is drawn. */
export interface PieceDrawn extends Box3 {
  readonly colour: number
  readonly visible: boolean
}

type Fields = Readonly<Record<string, unknown>>
const metres = (value: unknown): number => Number(value ?? 0) / Q16

const CHEST_HEIGHT = 0.7
const CHEST_OPEN_HEIGHT = 0.4
const POT_HEIGHT = 0.6
const CRACKED_HEIGHT = 2.4
const BLOCK_HALF = 0.5
const BLOCK_HEIGHT = 1
const PLATE_HEIGHT = 0.05
const EYE = { from: 2.3, to: 2.9 }

/** A row's footprint from its `minX`..`maxZ` fields, or around `x`, `z` for a block. */
function footprint(fields: Fields, half = 0): { x0: number; z0: number; x1: number; z1: number } {
  if (fields.minX !== undefined)
    return {
      x0: metres(fields.minX),
      z0: metres(fields.minZ),
      x1: metres(fields.maxX),
      z1: metres(fields.maxZ),
    }
  const [x, z] = [metres(fields.x), metres(fields.z)]
  return { x0: x - half, z0: z - half, x1: x + half, z1: z + half }
}

/** The box that draws a row of `component` (the sim's component name), of the piece kind `def`. */
export function pieceDrawn(component: string, def: string, fields: Fields): PieceDrawn {
  const draw = (height: number, colour: number, base = 0, half = 0, visible = true): PieceDrawn => {
    const { x0, z0, x1, z1 } = footprint(fields, half)
    return { min: [x0, base, z0], max: [x1, base + height, z1], colour, visible }
  }
  switch (component) {
    case 'chest':
      return draw(
        fields.open === true ? CHEST_OPEN_HEIGHT : CHEST_HEIGHT,
        0xfeae34,
        0,
        0,
        fields.shown === true,
      )
    case 'block':
      return draw(BLOCK_HEIGHT, 0x8b9bb4, 0, BLOCK_HALF)
    case 'switch':
      return def === 'eye'
        ? draw(EYE.to - EYE.from, fields.on === true ? 0xffffff : 0x2ce8f5, EYE.from)
        : draw(PLATE_HEIGHT, fields.on === true ? 0xffffff : 0x2ce8f5)
    default:
      return def === 'cracked' ? draw(CRACKED_HEIGHT, 0x733e39) : draw(POT_HEIGHT, 0xa22633)
  }
}

interface WithRooms {
  readonly rooms: readonly {
    readonly minX: number
    readonly maxX: number
    readonly minZ: number
    readonly maxZ: number
  }[]
}

/** The area, of `areas`, whose rooms hold the point (metres), edges included; none for a point in none. */
export function areaOfPoint<T extends WithRooms>(areas: readonly T[], x: number, z: number): T | undefined {
  return areas.find((area) =>
    area.rooms.some(
      (room) => x >= room.minX / Q16 && x <= room.maxX / Q16 && z >= room.minZ / Q16 && z <= room.maxZ / Q16,
    ),
  )
}

interface WithEntities extends WithRooms {
  readonly entities: readonly { readonly def: string }[]
}

/**
 * The view of every row of `component` in the world (main.ts registers it): its box, redrawn as the row changes. The
 * piece's definition comes from the area that holds it, by the row's `piece` index.
 */
export function pieceView(component: string, areas: readonly WithEntities[]): View3dFactory {
  return (row) => {
    const fields = row.components[component]
    if (fields === undefined) return undefined
    const { x0, z0, x1, z1 } = footprint(fields, BLOCK_HALF)
    const area = areaOfPoint(areas, (x0 + x1) / 2, (z0 + z1) / 2)
    const def = area?.entities[Number(fields.piece ?? 0) - 1]?.def ?? component
    const node = new Container3D()
    let mesh: Mesh3D | undefined
    const draw = (current: Fields): void => {
      const drawn = pieceDrawn(component, def, current)
      node.visible = drawn.visible
      mesh?.destroy()
      const [ax, ay, az] = drawn.min
      const [bx, by, bz] = drawn.max
      mesh = new Mesh3D({
        geometry: new CubeGeometry({ width: bx - ax, height: by - ay, depth: bz - az }),
        material: new FlatMaterial({ baseColor: drawn.colour }),
      })
      mesh.position.set((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2)
      node.addChild(mesh)
    }
    draw(fields)
    return {
      container: node,
      update(curr) {
        const next = curr[component]
        if (next !== undefined) draw(next)
      },
      destroy() {
        node.destroy({ children: true })
      },
    }
  }
}
