import { describe, expect, it } from 'vitest'
import { place, ranked } from '#src/features/painted/place.ts'
import { type CameraLike, poseOf } from '#src/features/painted/pose.ts'
import {
  BASE,
  type CharacterDef,
  project,
  ScriptedActor,
  SPRITE_PITCH,
  stageFrame,
  type V3,
  zoomOf,
} from '#src/shared/figures/door.ts'
import { followCamera, orthographicCamera, perspectiveCamera } from '../../fixtures/cameras.ts'
import { painted } from '../../fixtures/painted-cell.ts'

const PPM = 192 / 2.6
const DEFS: readonly CharacterDef[] = BASE.map((base) => base.def)

/** The poses the placement is held to the builder's `stageFrame` under: the follow view at 640 × 360 and the painter's own. */
const POSES: readonly (readonly [string, CameraLike])[] = [
  ['perspective', followCamera([0, 0, 0])],
  ['orthographic', orthographicCamera([0, 5, 8], 0, 18, 320 / PPM)],
]
/** The centre of the view, 2 m left and 4 m deeper, and near the frame's edge. */
const PLACES: readonly (readonly [number, number])[] = [
  [0, 0],
  [-2, -4],
  [4.2, 0],
]

describe("the stage contract's placement for one figure", () => {
  for (const [name, camera] of POSES) {
    describe(`under the ${name} pose`, () => {
      const pose = poseOf(camera, [640, 360])
      for (const def of DEFS) {
        for (const [x, z] of PLACES) {
          it(`puts ${def.id} at [${x}, ${z}] where the builder's own stageFrame puts it`, () => {
            const actor = new ScriptedActor({ who: def, at: [x, z] }, { density: 2 })
            const sprite = stageFrame([actor], 0, pose).sprites[0]
            const at: V3 = [x, 0, z]
            const mine = place(pose, at, painted(def, pose, at), def.id)
            expect(sprite).toBeDefined()
            expect(mine?.sprite.screen).toEqual(sprite?.screen)
            expect(mine?.sprite.scale).toBe(sprite?.scale)
            expect(mine?.sprite.depth).toBeCloseTo(sprite?.depth ?? Number.NaN, 9)
            expect(mine?.sprite.cell.pitch).toBeCloseTo(SPRITE_PITCH, 12)
          })
        }
      }
    })
  }

  it("takes a zoom that is whole to 1e-9 as whole, as the builder does: a host's pixelsPerMetre need not round-trip", () => {
    // Zoom 3 is 3 · 96 / 2.6 pixels a metre; a hair under it rounds the half-texel down unless it is settled first.
    const exact = (3 * 96) / 2.6
    for (const pixelsPerMetre of [exact, exact - 1e-9, exact + 1e-9]) {
      const pose = poseOf(orthographicCamera([0, 5, 8], 0, 18, 320 / pixelsPerMetre), [640, 360])
      const at: V3 = [0, 0, 0]
      const actor = new ScriptedActor({ who: DEFS[0] as CharacterDef, at: [0, 0] }, { density: 2 })
      const sprite = stageFrame([actor], 0, pose).sprites[0]
      const mine = place(pose, at, painted(DEFS[0] as CharacterDef, pose, at), 'a')
      expect(mine?.sprite.scale).toBe(sprite?.scale)
      expect(mine?.sprite.scale).toBe(2)
    }
  })

  describe('on the texel grid (grid: true)', () => {
    // A pose where a texel is 2 pixels (zoom 4 at density 2), as The Last Light plays: 4 · 96 / 2.6 pixels a metre.
    const ppm = (4 * 96) / 2.6
    const pose = poseOf(orthographicCamera([0, 5, 8], 0, 18, 320 / ppm), [640, 360])
    const def = DEFS[1] as CharacterDef
    /** Her feet swept across 1.5 m in 1 mm steps: every sub-pixel phase, many times over. */
    const sweep = Array.from({ length: 1500 }, (_, i): V3 => [-0.75 + i / 1000, 0, 0])
    // One cell for all: an orthographic view sees every place from the same bearing, so the painter paints the same cell.
    const cell = painted(def, pose, [0, 0, 0])
    const placeAt = (at: V3, grid?: boolean) => place(pose, at, cell, 'a', grid === undefined ? {} : { grid })

    it("puts the cell's top-left on a multiple of the texel's pixels, where today's rounding often lands odd", () => {
      const odd = sweep.filter((at) => (placeAt(at)?.sprite.screen[0] ?? 0) % 2 !== 0)
      expect(odd.length).toBeGreaterThan(0)
      for (const at of sweep) {
        const placed = placeAt(at, true)
        expect(placed?.sprite.scale).toBe(2)
        expect(Math.abs((placed?.sprite.screen[0] ?? 1) % 2), `x at ${at[0]}`).toBe(0)
        expect(Math.abs((placed?.sprite.screen[1] ?? 1) % 2), `y at ${at[0]}`).toBe(0)
      }
    })

    it('does not jitter when she walks: the cell moves one texel at a time, never back, never more than half a texel off', () => {
      let last: number | undefined
      for (const at of sweep) {
        const placed = placeAt(at, true)
        if (!placed) throw new Error('not placed')
        const { screen, scale, cell } = placed.sprite
        const [ax] = project(pose, at)
        expect(Math.abs(screen[0] + scale * cell.anchor[0] - ax)).toBeLessThanOrEqual(scale / 2 + 1e-9)
        if (last !== undefined) expect([0, scale]).toContain(screen[0] - last)
        last = screen[0]
      }
    })

    it('holds still on the screen when the camera follows her by any fraction of a pixel', () => {
      const screens = new Set<string>()
      for (let i = 0; i < 400; i++) {
        const x = -0.2 + i / 1000
        const follow = poseOf(orthographicCamera([x, 5, 8], 0, 18, 320 / ppm), [640, 360])
        const at: V3 = [x, 0, 0]
        screens.add(String(place(follow, at, cell, 'a', { grid: true })?.sprite.screen))
      }
      expect([...screens]).toHaveLength(1)
    })

    it("leaves today's placement as it is without it", () => {
      for (const at of sweep.slice(0, 50)) expect(placeAt(at, false)?.sprite).toEqual(placeAt(at)?.sprite)
    })

    it('still lands the anchor texel where the quad stands', () => {
      const at: V3 = [0.0137, 0, 0]
      const placed = placeAt(at, true)
      if (!placed) throw new Error('not placed')
      const [px, py] = project(pose, [...placed.position])
      expect(px).toBeCloseTo(placed.sprite.screen[0] + placed.sprite.scale * placed.sprite.cell.anchor[0], 6)
      expect(py).toBeCloseTo(placed.sprite.screen[1] + placed.sprite.scale * placed.sprite.cell.anchor[1], 6)
    })
  })

  it('lands the anchor texel on screen + scale · anchor: the quad projected back is where the builder puts the cell', () => {
    for (const [, camera] of POSES) {
      const pose = poseOf(camera, [640, 360])
      for (const [x, z] of PLACES) {
        const at: V3 = [x, 0, z]
        const placed = place(pose, at, painted(DEFS[0] as CharacterDef, pose, at), 'a')
        expect(placed).toBeDefined()
        if (!placed) continue
        const { screen, scale, cell } = placed.sprite
        const [px, py] = project(pose, [...placed.position])
        expect(px).toBeCloseTo(screen[0] + scale * cell.anchor[0], 6)
        expect(py).toBeCloseTo(screen[1] + scale * cell.anchor[1], 6)
        expect(placed.pixelSize).toBeGreaterThan(0)
      }
    }
  })

  it('draws the same cell under a camera at 25°, 40° and 60°: the painter keeps its 18° whatever the tilt', () => {
    const keys = [25, 40, 60].map((tilt) => {
      // 8 m from the figure at each tilt, looking at a point 1 m above its feet.
      const back = 8
      const pitch = (tilt * Math.PI) / 180
      const camera = perspectiveCamera([0, 1 + back * Math.sin(pitch), back * Math.cos(pitch)], 0, tilt)
      const pose = poseOf(camera, [640, 360])
      const at: V3 = [0, 0, 0]
      const placed = place(pose, at, painted(DEFS[0] as CharacterDef, pose, at), 'a')
      expect(placed?.sprite.cell.pitch).toBeCloseTo(SPRITE_PITCH, 12)
      return placed?.sprite.cell.key
    })
    expect(new Set(keys).size).toBe(1)
  })

  it('keeps a texel at one pixel at 480 × 270 under the follow view: it is under true scale there (about 0.67 of a pixel)', () => {
    const pose = poseOf(followCamera([0, 0, 0]), [480, 270])
    const at: V3 = [0, 0, 0]
    const placed = place(pose, at, painted(DEFS[0] as CharacterDef, pose, at), 'a')
    expect(zoomOf(pose, at) / 2).toBeGreaterThan(0.6)
    expect(zoomOf(pose, at) / 2).toBeLessThan(0.72)
    expect(placed?.sprite.scale).toBe(1)
  })

  it('leaves out a figure behind a perspective camera, 0.05 m in front of it, and keeps one under an orthographic one', () => {
    const at: V3 = [0, 0, -0.05]
    const perspective = poseOf(perspectiveCamera([0, 0, 0], 0, 0), [640, 360])
    expect(place(perspective, at, painted(DEFS[0] as CharacterDef, perspective, at), 'a')).toBeUndefined()
    const orthographic = poseOf(orthographicCamera([0, 5, 8], 0, 18, 320 / PPM), [640, 360])
    expect(place(orthographic, at, painted(DEFS[0] as CharacterDef, orthographic, at), 'a')).toBeDefined()
  })

  it('writes no NaN anywhere in a placement, at the frame edge or far off it', () => {
    for (const [, camera] of POSES) {
      const pose = poseOf(camera, [640, 360])
      for (const x of [-40, -4.6, 0, 4.6, 40]) {
        const at: V3 = [x, 0, 1]
        const placed = place(pose, at, painted(DEFS[1] as CharacterDef, pose, at), 'a')
        if (!placed) continue
        const numbers = [
          ...placed.position,
          ...placed.sprite.screen,
          placed.sprite.scale,
          placed.sprite.depth,
          placed.pixelSize,
        ]
        for (const n of numbers) expect(Number.isFinite(n)).toBe(true)
      }
    }
  })

  it('ranks far to near and keeps the given order on a tie', () => {
    const pose = poseOf(orthographicCamera([0, 5, 8], 0, 18, 320 / PPM), [640, 360])
    const make = (name: string, z: number) => {
      const at: V3 = [0, 0, z]
      const placed = place(pose, at, painted(DEFS[0] as CharacterDef, pose, at), name)
      if (!placed) throw new Error('placed')
      return placed
    }
    const order = ranked([make('near', 2), make('far', -3), make('far-too', -3), make('middle', 0)]).map(
      (placed) => placed.sprite.name,
    )
    expect(order).toEqual(['far', 'far-too', 'middle', 'near'])
  })
})
