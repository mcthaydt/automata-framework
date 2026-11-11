import { describe, expect, it } from 'vitest'
import { paintView, place, ranked } from '#src/features/painted/place.ts'
import { type CameraLike, poseOf } from '#src/features/painted/pose.ts'
import {
  BASE,
  type CameraPose,
  type CharacterDef,
  cellOf,
  Figure,
  member,
  project,
  ScriptedActor,
  SPRITE_PITCH,
  stageFrame,
  type V3,
  zoomOf,
} from '#src/shared/figure-builder/door.ts'
import { followCamera, orthographicCamera, perspectiveCamera } from '../../fixtures/cameras.ts'

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

/** What the kit paints for `def` at `at` under `pose`: the figure the way `paintedFigure` draws it. */
function painted(def: CharacterDef, pose: CameraPose, at: V3) {
  const figure = new Figure(member(def, 2))
  figure.update(1 / 60, { facing: 0, moving: false, view: paintView(pose, at) })
  return cellOf(figure)
}

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
