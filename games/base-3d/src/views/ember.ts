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
  /** Sparks rising from it at once (Emberwick's ember throws them). */
  readonly sparks: number
}

export const EMBER_LOOK: EmberLook = {
  size: 0.16,
  core: 'ember',
  glow: 0.7,
  light: { colour: 'ember', range: 2.6, intensity: 1.4 },
  column: 0,
  sparks: 6,
}
export const GOAL_LOOK: EmberLook = {
  size: 0.3,
  core: 'spark',
  glow: 2.4,
  light: { colour: 'lantern', range: 5, intensity: 2.2 },
  column: 6,
  sparks: 16,
}

/** The pulse at `seconds`: 1 ± 0.14, four radians a second, offset by `phase` so neighbours do not beat together. */
export const pulse = (seconds: number, phase: number): number => 1 + 0.14 * Math.sin(seconds * 4 + phase)

/** The turn at `seconds`, 1.5 radians a second. */
export const turn = (seconds: number): number => seconds * 1.5

/** How long a spark takes to rise and fade, in seconds. */
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
    const glows: [y: number, size: number, alpha: number][] = [[height, look.size * 8, 1]]
    for (let i = 1; i <= look.column; i++) glows.push([height + i * 0.7, 1.1 - i * 0.08, 0.5 - i * 0.05])
    // The halo, the column and the sparks share one additive container: one draw an ember.
    const glow = new ParticleContainer3D({
      label: 'ember:glow',
      texture: nightTextures().glow,
      capacity: glows.length + look.sparks,
      blendMode: 'add',
      billboard: 'spherical',
      space: 'local',
    })
    node.addChild(glow, core, light)

    const haloColour = colour(look.light.colour)
    const animate = (): void => {
      const seconds = clock()
      const scale = pulse(seconds, phase)
      core.scale.set(scale, scale * 1.5, scale)
      core.rotation.set(0, turn(seconds), 0)
      glows.forEach(([y, size, alpha], i) => {
        glow.setParticleAt(i, 0, y, 0, size * (i === 0 ? 2 - scale : 1), 0, haloColour, alpha)
      })
      for (let i = 0; i < look.sparks; i++) {
        // Each spark rises 1.6 m over its life, spreading a little and fading; their starts are spread evenly.
        const life = (seconds / SPARK_LIFE + i / look.sparks) % 1
        const angle = i * 2.4
        const tint = colour(SPARK_COLOURS[i % SPARK_COLOURS.length] as Token)
        glow.setParticleAt(
          glows.length + i,
          Math.sin(angle) * 0.25 * life,
          height + life * (look === GOAL_LOOK ? 1.6 : 0.9),
          Math.cos(angle) * 0.25 * life,
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
