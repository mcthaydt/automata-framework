// An ember in the night (art direction spec §2): a glowing crystal that turns and pulses, its own warm light and an
// additive halo, as Emberwick's ember has its light, halo and sparks. The goal ember is larger and gold, with a column
// of light over it and sparks rising, so it reads from across the room and from behind Wick. A row view, so a taken
// ember (its entity removed) takes its light with it. The clock is the page's own (presentation, not the sim).
import type { View3dFactory } from '@mcthaydt/automata-render-pixi3d'
import { Q16 } from '@mcthaydt/automata-render-pixi3d/sim'
import {
  Container3D,
  IcosahedronGeometry,
  Mesh3D,
  ParticleContainer3D,
  PhongMaterial,
  PointLight,
} from '@pixi/3d'
import { nightTextures } from './night-textures.ts'
import { colour, type Token } from './palette.ts'

/** One kind of ember: its core's radius in metres, colour and glow, its light, and the column over it (0 for none). */
export interface EmberLook {
  readonly size: number
  readonly core: Token
  readonly glow: number
  readonly light: { readonly colour: Token; readonly range: number; readonly intensity: number }
  readonly column: number
}

export const EMBER_LOOK: EmberLook = {
  size: 0.16,
  core: 'ember',
  glow: 2,
  light: { colour: 'ember', range: 2.6, intensity: 1.4 },
  column: 0,
}
export const GOAL_LOOK: EmberLook = {
  size: 0.3,
  core: 'spark',
  glow: 2.4,
  light: { colour: 'lantern', range: 5, intensity: 2.2 },
  column: 6,
}

/** The pulse at `seconds`: 1 ± 0.14, four radians a second, offset by `phase` so neighbours do not beat together. */
export const pulse = (seconds: number, phase: number): number => 1 + 0.14 * Math.sin(seconds * 4 + phase)

/** The turn at `seconds`, 1.5 radians a second. */
export const turn = (seconds: number): number => seconds * 1.5

/** The goal's sparks, and how long one takes to rise and fade, in seconds. */
const SPARKS = 16
const SPARK_LIFE = 1.4
const SPARK_COLOURS: readonly Token[] = ['spark', 'lantern', 'ember', 'hot']

/** The view of every `ember` row, over `clock` (seconds). */
export const emberView =
  (clock: () => number): View3dFactory =>
  (row) => {
    const fields = row.components.ember
    if (fields === undefined) return undefined
    const look = fields.goal === true ? GOAL_LOOK : EMBER_LOOK
    const [x, z] = [Number(fields.x) / Q16, Number(fields.z) / Q16]
    const phase = x * 1.7 + z * 0.9
    const height = look === GOAL_LOOK ? 0.9 : 0.55
    const node = new Container3D()
    node.position.set(x, 0, z)

    const core = new Mesh3D({
      label: 'ember:core',
      geometry: new IcosahedronGeometry({ radius: look.size }),
      material: new PhongMaterial({
        baseColor: colour(look.core),
        emissive: { color: colour(look.core), strength: look.glow },
      }),
    })
    core.position.set(0, height, 0)
    const light = new PointLight({
      color: colour(look.light.colour),
      intensity: look.light.intensity,
      range: look.light.range,
    })
    light.position.set(0, height + 0.05, 0)

    // The halo, and over the goal a column of fainter glows stacked up into the dark.
    const glows: [y: number, size: number, alpha: number][] = [[height, look.size * 7, 0.8]]
    for (let i = 1; i <= look.column; i++) glows.push([height + i * 0.7, 0.9 - i * 0.06, 0.32 - i * 0.03])
    const glow = nightTextures().glow
    const halo = new ParticleContainer3D({
      label: 'ember:halo',
      texture: glow,
      capacity: glows.length,
      blendMode: 'add',
      billboard: 'spherical',
      space: 'local',
    })
    const sparks =
      look === GOAL_LOOK
        ? new ParticleContainer3D({
            label: 'ember:sparks',
            texture: glow,
            capacity: SPARKS,
            blendMode: 'add',
            billboard: 'spherical',
            space: 'local',
          })
        : undefined
    node.addChild(halo, core, light)
    if (sparks !== undefined) node.addChild(sparks)

    const haloColour = colour(look.light.colour)
    const animate = (): void => {
      const seconds = clock()
      const scale = pulse(seconds, phase)
      core.scale.set(scale, scale * 1.5, scale)
      core.rotation.set(0, turn(seconds), 0)
      glows.forEach(([y, size, alpha], i) => {
        halo.setParticleAt(i, 0, y, 0, size * (i === 0 ? 2 - scale : 1), 0, haloColour, alpha)
      })
      if (sparks === undefined) return
      for (let i = 0; i < SPARKS; i++) {
        // Each spark rises 1.6 m over its life, spreading a little and fading; their starts are spread evenly.
        const life = (seconds / SPARK_LIFE + i / SPARKS) % 1
        const angle = i * 2.4
        const tint = colour(SPARK_COLOURS[i % SPARK_COLOURS.length] as Token)
        sparks.setParticleAt(
          i,
          Math.sin(angle) * 0.3 * life,
          height + life * 1.6,
          Math.cos(angle) * 0.3 * life,
          0.1,
          0,
          tint,
          1 - life,
        )
      }
    }
    animate()
    return { container: node, update: animate, destroy: () => node.destroy({ children: true }) }
  }
