// An ember in the 3D scene: a glowing block that turns and pulses, with a paler halo; the goal ember is larger and gold with
// a tall beam of light over it, so it reads from across the room and from behind Wick. A row view, so a taken ember (its
// entity removed) disappears. Procedural, in Emberwick's warm palette; the clock is the page's own (presentation, not the sim).
import type { View3dFactory } from '@automata/3d'
import { Q16 } from '@automata/3d/sim'
import { Container3D, CubeGeometry, FlatMaterial, Mesh3D } from '@pixi/3d'

/** One kind of ember: the core's side in metres and colour, the halo's colour, and the beam (the goal's) if it has one. */
export interface EmberLook {
  readonly side: number
  readonly core: number
  readonly halo: number
  readonly beam?: { readonly height: number; readonly colour: number } | undefined
}

export const EMBER_LOOK: EmberLook = { side: 0.3, core: 0xfb6b1d, halo: 0xfeae34 }
export const GOAL_LOOK: EmberLook = {
  side: 0.5,
  core: 0xfee761,
  halo: 0xfeae34,
  beam: { height: 6, colour: 0xfee761 },
}

/** The pulse at `seconds`: 1 ± 0.14, four radians a second, offset by `phase` so neighbours do not beat together. */
export const pulse = (seconds: number, phase: number): number => 1 + 0.14 * Math.sin(seconds * 4 + phase)

/** The turn at `seconds`, 1.5 radians a second. */
export const turn = (seconds: number): number => seconds * 1.5

const cube = (side: number, colour: number): Mesh3D =>
  new Mesh3D({
    geometry: new CubeGeometry({ width: side, height: side, depth: side }),
    material: new FlatMaterial({ baseColor: colour }),
  })

/** The view of every `ember` row, over `clock` (seconds): turning and pulsing core, halo, and the goal's beam. */
export const emberView =
  (clock: () => number): View3dFactory =>
  (row) => {
    const fields = row.components.ember
    if (fields === undefined) return undefined
    const look = fields.goal === true ? GOAL_LOOK : EMBER_LOOK
    const [x, z] = [Number(fields.x) / Q16, Number(fields.z) / Q16]
    const phase = x * 1.7 + z * 0.9
    const node = new Container3D()
    node.position.set(x, look.side / 2 + 0.25, z)
    const core = cube(look.side, look.core)
    const halo = cube(look.side * 1.7, look.halo)
    node.addChild(halo, core)
    if (look.beam !== undefined) {
      const beam = new Mesh3D({
        geometry: new CubeGeometry({ width: 0.12, height: look.beam.height, depth: 0.12 }),
        material: new FlatMaterial({ baseColor: look.beam.colour }),
      })
      beam.position.set(0, look.beam.height / 2, 0)
      node.addChild(beam)
    }
    const animate = (): void => {
      const seconds = clock()
      const scale = pulse(seconds, phase)
      core.scale.set(scale, scale, scale)
      core.rotation.set(0, turn(seconds), 0)
      // The halo turns the other way, a quarter turn behind, and breathes against the core.
      const breath = 2 - scale
      halo.scale.set(breath, breath, breath)
      halo.rotation.set(0, -turn(seconds) + Math.PI / 4, 0)
    }
    animate()
    return { container: node, update: animate, destroy: () => node.destroy({ children: true }) }
  }
