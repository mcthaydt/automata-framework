// A world's room light from the world and its time of day: the lamps, the ambient and the occluders the level gives,
// with nothing written by hand.
import { describe, expect, it } from 'vitest'
import { worldLighting } from '#src/app/world-lighting.ts'
import { sceneLamps } from '#src/app/world-view.ts'
import { BASE_SCENES, baseLibrary } from '#src/entries/base.ts'
import { buildWorld } from '#src/features/world/build.ts'
import { worldOccluders } from '#src/features/world/occluders.ts'
import { sceneLightingSchema } from '#src/shared/render/light/scene-lighting.schema.ts'
import { levelTime } from '#src/shared/time-of-day/time-light.ts'

const interior = BASE_SCENES['base-interior']
const exterior = BASE_SCENES['base-exterior']
const worldOf = (level: typeof interior, night: boolean) => buildWorld(level, baseLibrary, { night })

describe('worldLighting', () => {
  it('takes the lamps the world carries, the time’s ambient and the occluders of the pieces', () => {
    const world = worldOf(interior, true)
    const time = levelTime(interior.time)
    const lighting = worldLighting(world, time)
    expect(lighting.ambient).toBe(time.scene.light.ambient.level)
    expect(lighting.lamps).toEqual(sceneLamps(world.lamps, true))
    const { boxes, planes } = worldOccluders(world.pieces)
    expect(lighting.boxes).toEqual(boxes)
    expect(lighting.planes).toEqual(planes)
    expect(boxes.length + planes.length).toBeGreaterThan(5)
  })
  it('leaves a lamp on its photocell out by day, as the time says it is day', () => {
    const day = levelTime(exterior.time)
    const world = worldOf(exterior, false)
    const dusk = world.lamps.filter((lamp) => lamp.dusk)
    expect(dusk.length).toBeGreaterThan(0)
    expect(worldLighting(world, day).lamps).toHaveLength(world.lamps.length - dusk.length)
    expect(worldLighting(world, day, { night: true }).lamps).toHaveLength(world.lamps.length)
  })
  it('is something the lighting schema reads', () => {
    const lighting = worldLighting(worldOf(interior, true), levelTime(interior.time))
    expect(() => sceneLightingSchema.parse(lighting)).not.toThrow()
  })
})
