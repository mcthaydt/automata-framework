import { describe, expect, it } from 'vitest'
import { worldLighting } from '#src/app/world-lighting.ts'
import { DEFAULT_LOOK } from '#src/features/look/look.ts'
import { BASE_SCENES } from '#src/features/world/base/base-scenes.ts'
import { coreLibrary } from '#src/features/world/base/core-library.ts'
import { buildWorld } from '#src/features/world/build.ts'
import { bakeVertices } from '#src/shared/render/light/vertex-bake.ts'
import { timeOfDay } from '#src/shared/time-of-day/time-of-day.ts'
import { environmentBuilderLook } from '#src/testing/oracles.ts'

const IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
// The diorama camera of the source, whose key the sun takes.
const PITCH = (18 * Math.PI) / 180
const oracle = environmentBuilderLook()

interface Point {
  readonly at: readonly number[]
  readonly gap: number
}

/** The bake's light at each oracle point of a scene, against the source's: how far apart the brightest channel is. */
function differences(scene: 'base-interior' | 'base-exterior', time: string): Point[] {
  const level = BASE_SCENES[scene]
  const world = buildWorld(level, coreLibrary)
  const lighting = worldLighting({
    pieces: world.pieces,
    lamps: world.lamps,
    time: timeOfDay(time),
    look: DEFAULT_LOOK,
    pitch: PITCH,
    // The source's measurement lit every lamp, the day's street lamp too.
    night: true,
  })
  const points = oracle.vertexLight.filter((p) => p.scene === scene)
  const positions = new Float32Array(points.flatMap((p) => [...p.at]))
  const normals = new Float32Array(points.flatMap((p) => [...p.normal]))
  const out = new Float32Array(points.length * 4)
  bakeVertices(positions, normals, IDENTITY, lighting).write({}, out)
  return points.map((p, i) => ({
    at: p.at,
    gap: Math.abs(Math.max(out[i * 4] ?? 0, out[i * 4 + 1] ?? 0, out[i * 4 + 2] ?? 0) - Math.max(...p.light)),
  }))
}

// The interior agrees at every point. The exterior's 200 points include a tree whose crown the bake holds as one box (the
// source draws its shadow from a depth map), so a point under the crown differs, and a street lamp whose kit level the
// lamps' own task sets; 90% of them agreeing is what the bake's boxes can give.
describe('the bake against the source’s vertex light', () => {
  for (const [scene, time, least] of [
    ['base-interior', 'lampLit', 1],
    ['base-exterior', 'day', 0.9],
  ] as const)
    it(`${scene} at ${time}: the brightest channel of ${least * 100}% of the oracle points within one step`, () => {
      const points = differences(scene, time)
      const beyond = points.filter((p) => p.gap > DEFAULT_LOOK.light.step + 1e-6)
      console.info(
        `${scene}: ${points.length - beyond.length} of ${points.length} points within one step; beyond: ${beyond
          .map((p) => `${p.at.map((v) => v.toFixed(2))} (${p.gap.toFixed(2)})`)
          .join('; ')}`,
      )
      expect(1 - beyond.length / points.length).toBeGreaterThanOrEqual(least)
    })
})
