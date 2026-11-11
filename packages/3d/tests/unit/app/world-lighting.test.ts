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
    expect(lighting.lamps.map((l) => l.id)).toEqual(sceneLamps(world.lamps, true).map((l) => l.id))
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

  it('lights as the look profile does: sRGB light with a key, a fill, steps of 0.1 and a cap of 1.6', () => {
    const lighting = worldLighting(worldOf(interior, true), levelTime(interior.time))
    expect(lighting.colorSpace).toBe('srgb')
    expect(lighting.key).toEqual({ dir: [0.3, 0.8, 0.5], level: 0.09 })
    expect(lighting.fill).toEqual({ level: 0.08, color: 0xc6ecff, fade: [1.5, 4, 0.25] })
    expect([lighting.step, lighting.max, lighting.shade]).toEqual([0.1, 1.6, 0.85])
    expect(lighting.sun).toBeUndefined()
  })
  it('makes each lamp 2.6 times its level, and keeps its aim and cone', () => {
    const world = worldOf(interior, true)
    const lighting = worldLighting(world, levelTime(interior.time))
    const pendant = world.lamps.find((l) => l.kind === 'pendant')!
    const lamp = lighting.lamps.find((l) => l.id === pendant.id)!
    expect(lamp.strength).toBeCloseTo(2.6)
    expect(lamp.aim).toEqual(pendant.aim)
    expect(lamp.cone).toBe(pendant.cone)
  })
  it('gives the day a sun toward the time’s key, seen from 18° up, with the time’s shadow rule', () => {
    const day = levelTime(exterior.time)
    const { sun } = worldLighting(worldOf(exterior, false), day)
    // The figures' key (-0.5, 0.62, 0.6) in view space, turned out of a camera pitched 18° down: (x, y c + z s, -y s + z c).
    const [x, y, z] = [-0.5, 0.62, 0.6]
    const [c, s] = [Math.cos(0.1 * Math.PI), Math.sin(0.1 * Math.PI)]
    const world = [x, y * c + z * s, -y * s + z * c]
    const length = Math.hypot(...world)
    for (const [i, v] of world.entries()) expect(sun!.dir[i]).toBeCloseTo(v / length, 9)
    expect(sun!.color).toBe(0xfff3d6)
    expect(sun!.level).toBe(1)
    expect(sun!.shadow).toBe(day.scene.light.shadow)
  })
})
