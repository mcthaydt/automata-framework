// The night's light, baked into the stone's vertices (the Owner: "we only used vertex lighting though, no real time"):
// a moonlit ambient, the moon itself as a far lamp, a lamp at each glowing mushroom cluster and one at the goal.
// Content for render-pixi3d's bake, checked by its own schema.
import { sceneLightingSchema } from '@mcthaydt/automata-render-pixi3d'
import { describe, expect, it } from 'vitest'
import { ROOM } from '../content/room.ts'
import { dressingOf } from './dressing.ts'
import { nightLighting } from './lighting.ts'
import { colour } from './palette.ts'

describe('nightLighting', () => {
  const lighting = nightLighting(ROOM)
  const dressing = dressingOf(ROOM)

  it('is valid scene-lighting content, the same every time', () => {
    expect(sceneLightingSchema.parse(lighting)).toEqual(lighting)
    expect(nightLighting(ROOM)).toEqual(lighting)
  })

  it('lights each mushroom cluster in its own colour, the goal warm, and the room from the moon', () => {
    for (const spot of dressing.lights)
      expect(lighting.lamps).toContainEqual(
        expect.objectContaining({ x: spot.x, y: spot.y, z: spot.z, color: colour(spot.colour) }),
      )
    expect(lighting.lamps).toContainEqual(
      expect.objectContaining({ id: 'goal', x: ROOM.goal.x, z: ROOM.goal.z, color: colour('lantern') }),
    )
    const moon = lighting.lamps.find((lamp) => lamp.id === 'moon')
    expect(moon?.color).toBe(colour('moonlight'))
    // High and far, toward the moon's side, reaching the whole room.
    expect(moon?.y).toBeGreaterThan(8)
    expect(moon?.range).toBeGreaterThan(40)
    expect(new Set(lighting.lamps.map((lamp) => lamp.id)).size).toBe(lighting.lamps.length)
  })

  it('keeps a moonlit ambient so the stone between the lamps reads blue, not black', () => {
    expect(lighting.ambientColor).toBe(colour('moonlight'))
    expect(lighting.ambient).toBeGreaterThan(0.2)
  })
})
