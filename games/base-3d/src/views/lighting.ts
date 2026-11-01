// The night's light, baked once into the static stone's vertices by render-pixi3d (the Owner: "we only used vertex
// lighting though, no real time", as the 3D reference game lights its rooms): a moonlit ambient, the moon as one far
// lamp so the room shades toward it, a lamp at each glowing mushroom cluster and a warm one at the goal. Wick takes the
// same light at his chest each frame (the figure view's tint). Presentation only (law 1): derived from the room.
import type { Lamp, SceneLighting } from '@mcthaydt/automata-render-pixi3d'
import type { AreaSource } from '../systems/index.ts'
import { dressingOf } from './dressing.ts'
import { colour } from './palette.ts'

/** The moonlit ambient: how much moonlight reaches stone no lamp does. */
const AMBIENT = 0.32
/** The moon as a lamp: high on its side of the sky, reaching the whole room, a soft key over the ambient. */
const MOON = { x: -14, y: 18, z: 34, range: 70, strength: 1.3 } as const
/** A mushroom cluster's light is its dressing light; the bake's falloff is steeper, so a little stronger. */
const MUSHROOM_STRENGTH = 1.6
/** The goal ember's warm pool. */
const GOAL = { y: 0.9, range: 5, strength: 2 } as const

export function nightLighting(area: AreaSource): SceneLighting {
  const dressing = dressingOf(area)
  const lamp = (id: string, fields: Omit<Lamp, 'id' | 'level'>): Lamp => ({ id, ...fields, level: 1 })
  return {
    ambient: AMBIENT,
    ambientColor: colour('moonlight'),
    lamps: [
      lamp('moon', {
        x: MOON.x,
        y: MOON.y,
        z: MOON.z,
        color: colour('moonlight'),
        strength: MOON.strength,
        range: MOON.range,
      }),
      ...dressing.lights.map((spot, i) =>
        lamp(`mushroom-${i}`, {
          x: spot.x,
          y: spot.y,
          z: spot.z,
          color: colour(spot.colour),
          strength: spot.intensity * MUSHROOM_STRENGTH,
          range: spot.range,
        }),
      ),
      lamp('goal', {
        x: area.goal.x,
        y: GOAL.y,
        z: area.goal.z,
        color: colour('lantern'),
        strength: GOAL.strength,
        range: GOAL.range,
      }),
    ],
    boxes: [],
    planes: [],
  }
}
