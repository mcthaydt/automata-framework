// A figure that asks for `density: 'auto'` is drawn at the density the camera needs, and the texels it shows are that paint's:
// pulled close it is painted at 4 and a texel is a pixel; far off it is painted at 1; a figure that pins a density keeps it, and one
// that names none is painted at 2, as it always was. Under WebGL and WebGPU alike; the cell and the placement are read off the stage,
// and the pixels off the canvas.
import { afterEach, describe, expect, it } from 'vitest'
import { BASE, type CharacterDef, zoomOf } from '#src/shared/figures/door.ts'
import { aim, buildScene, DEG, poseNow, type StageScene } from '../../fixtures/stage-scene.ts'

const hasWebGL2 = document.createElement('canvas').getContext('webgl2') !== null
const MAN = BASE[0]?.def as CharacterDef
const SIZE = [640, 360] as const

let scene: StageScene | undefined
afterEach(() => {
  scene?.dispose()
  scene = undefined
})

/** A scene with one figure at the origin, the camera level with it on +z at the distance that gives it `zoom`. */
async function sceneAt(
  zoom: number,
  options: Parameters<typeof buildScene>[0]['figures'][number]['options'] = { density: 'auto' },
) {
  scene = await buildScene({ size: SIZE, camera: 'follow', figures: [{ def: MAN, at: [0, 0], options }] })
  const camera = scene.view.camera
  aim(scene.view, SIZE, 'follow', 0, 0)
  // Zoom is pixels a metre over 96 / 2.6 (a density-1 texel a pixel); a pixel is a metre over f / depth.
  const f = SIZE[1] / 2 / Math.tan((camera.fov * DEG) / 2)
  const depth = f / (zoom * (96 / 2.6))
  camera.position.set(0, 1, depth)
  camera.lookAt({ x: 0, y: 1, z: 0 })
  scene.draw()
  return scene
}

describe.runIf(hasWebGL2)('a painted figure at the density its camera needs', () => {
  it('is painted at 4, a texel a pixel, when the camera is pulled in to zoom 4', async () => {
    const s = await sceneAt(4)
    expect(zoomOf(poseNow(s.view, SIZE), [0, 0, 0])).toBeCloseTo(4, 1)
    const placed = s.stage.placed[0]
    expect(placed?.sprite.cell.size).toEqual([256, 384])
    // Not a smaller cell scaled up: a texel of this paint is no more than a field pixel on the screen.
    expect(placed?.sprite.scale).toBeLessThanOrEqual(1.0001)
  })

  it('is painted at 1 when the camera is far off, and the stage places that cell', async () => {
    const s = await sceneAt(1.43)
    const placed = s.stage.placed[0]
    expect(placed?.sprite.cell.size).toEqual([64, 96])
  })

  it('is painted at 2 for a mid shot, and 8 when the game lifts the cap to 8 for a shot at zoom 8', async () => {
    expect((await sceneAt(2.7)).stage.placed[0]?.sprite.cell.size).toEqual([128, 192])
    scene?.dispose()
    const s = await sceneAt(8, { density: 'auto', maxDensity: 8 })
    expect(s.stage.placed[0]?.sprite.cell.size).toEqual([512, 768])
    expect(s.stage.placed[0]?.sprite.scale).toBeLessThanOrEqual(1.0001)
  })

  it('is painted at 2, whatever the camera, when it names no density (opt in with density: auto)', async () => {
    for (const zoom of [1.43, 4]) {
      const s = await sceneAt(zoom, {})
      expect(s.stage.placed[0]?.sprite.cell.size).toEqual([128, 192])
      s.dispose()
      scene = undefined
    }
  })

  it('keeps the density a figure pins, whatever the camera', async () => {
    const s = await sceneAt(4, { density: 1 })
    expect(s.stage.placed[0]?.sprite.cell.size).toEqual([64, 96])
    expect(s.stage.placed[0]?.sprite.scale).toBeCloseTo(4, 1)
  })

  it('does not flicker when the camera sits on a boundary', async () => {
    const s = await sceneAt(4)
    const camera = s.view.camera
    const sizes = new Set<number>()
    const f = SIZE[1] / 2 / Math.tan((camera.fov * DEG) / 2)
    for (let i = 0; i < 12; i++) {
      const zoom = 4 * (1 + (i % 2 === 0 ? -0.01 : 0.01))
      camera.position.set(0, 1, f / (zoom * (96 / 2.6)))
      camera.lookAt({ x: 0, y: 1, z: 0 })
      s.draw()
      sizes.add(s.stage.placed[0]?.sprite.cell.size[0] ?? 0)
    }
    expect(sizes.size).toBe(1)
  })
})
