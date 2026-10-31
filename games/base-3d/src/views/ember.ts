// An ember in the 3D scene as a small glowing block standing on the floor: the goal ember larger and paler. It is a row
// view, so a taken ember (its entity removed) disappears. Presentation; the art is GAME-3D.1j's.
import type { View3dFactory } from '@mcthaydt/automata-render-pixi3d'
import { Q16 } from '@mcthaydt/automata-render-pixi3d/sim'
import { Container3D, CubeGeometry, FlatMaterial, Mesh3D } from '@pixi/3d'

const EMBER = { side: 0.3, colour: 0xfb6b1d }
const GOAL = { side: 0.5, colour: 0xfeae34 }

/** The view of every `ember` row: a block of its kind at its place, a hair above the floor. */
export const emberView: View3dFactory = (row) => {
  const fields = row.components.ember
  if (fields === undefined) return undefined
  const kind = fields.goal === true ? GOAL : EMBER
  const node = new Container3D()
  const mesh = new Mesh3D({
    geometry: new CubeGeometry({ width: kind.side, height: kind.side, depth: kind.side }),
    material: new FlatMaterial({ baseColor: kind.colour }),
  })
  mesh.position.set(Number(fields.x) / Q16, kind.side / 2 + 0.05, Number(fields.z) / Q16)
  node.addChild(mesh)
  return { container: node, destroy: () => node.destroy({ children: true }) }
}
