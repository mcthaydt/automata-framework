// A world's room light from the world and its time of day: the lamps, the ambient and the occluders the level gives,
// with nothing written by hand.
import { describe, expect, it } from 'vitest'
import { worldLighting } from '#src/app/world-lighting.ts'
import { sceneLamps } from '#src/app/world-view.ts'
import { BASE_SCENES, baseLibrary } from '#src/entries/base.ts'
import { buildWorld } from '#src/features/world/build.ts'
import { worldOccluders } from '#src/features/world/occluders.ts'
import { sceneLightingSchema } from '#src/shared/render/light/scene-lighting.schema.ts'
import { bakeVertices } from '#src/shared/render/light/vertex-bake.ts'
import { stepLight } from '#src/shared/render/light/vertex-light.ts'
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
  it('lights the open road by day as the builder’s formula does: the ambient and key, plus the sun times N·L, stepped', () => {
    // EnvironmentBuilder's `baseLight` for an upright-up surface in the open: (ambient + key level × (n · key dir)) × the
    // ambient's tint (its brightest channel 1), plus the sun's colour × its level × N·L, then the cap and the 0.1 steps.
    // No fill (it lights upright surfaces), no contact darkening on the open road, no shadow over it.
    const day = levelTime(exterior.time)
    const world = worldOf(exterior, false)
    const lighting = worldLighting(world, day)
    const tint = [16, 8, 0].map((shift) => ((lighting.ambientColor >> shift) & 255) / 255)
    const top = Math.max(...tint)
    const keyed = lighting.ambient + 0.8 * lighting.key!.level
    const sun = lighting.sun!
    const sunRgb = [16, 8, 0].map((shift) => (((sun.color >> shift) & 255) / 255) * sun.level)
    const sum = tint.map((t, c) => keyed * (t / top) + (sunRgb[c] as number) * sun.dir[1]) as [
      number,
      number,
      number,
    ]
    const expected = stepLight(
      sum.map((v) => Math.min(lighting.max, v)) as [number, number, number],
      lighting.step,
    )
    const road = world.pieces.find((p) => p.id === 'road:floor')!
    const bake = bakeVertices(
      new Float32Array(road.mesh.positions),
      new Float32Array(road.mesh.normals),
      [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
      lighting,
      [],
      { textured: true },
    )
    const out = new Float32Array(bake.vertexCount * 4)
    bake.write({}, out)
    // Away from the kerb (whose contact darkening is the builder's own rule) every vertex of the road has the same light:
    // nothing stands over it, and it does not shadow itself.
    let checked = 0
    for (let i = 0; i < bake.vertexCount; i++) {
      if ((road.mesh.positions[i * 3 + 2] as number) < 1) continue
      checked++
      for (let c = 0; c < 3; c++)
        expect(out[i * 4 + c], `vertex ${i} channel ${c}`).toBeCloseTo(expected[c] as number, 4)
    }
    expect(checked).toBeGreaterThan(500)
  })
})
