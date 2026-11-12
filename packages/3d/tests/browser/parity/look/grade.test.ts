// The mood grade on a real WebGL2 context: with no mood the frame is as it was; with one the colours move, and, because the
// grade runs before the snap, every pixel still lands on the palette. WebGPU and WebGL2 parity is the GPU runner's.
import '#src/entries/no-eval.ts'
import { DEFAULT_PALETTE } from '@automata/content/palette'
import { CubeGeometry, FlatMaterial, Mesh3D } from '@pixi/3d'
import { afterEach, describe, expect, it } from 'vitest'
import { createPixi3dRenderer, type Pixi3dRenderer } from '#src/app/create-renderer.ts'
import { MOODS } from '#src/features/look/grade.ts'
import { GradeEffect } from '#src/features/look/grade-effect.ts'
import type { Look } from '#src/features/look/look.schema.ts'
import { DEFAULT_LOOK, parseLook } from '#src/features/look/look.ts'
import { builtRenderer } from '#src/testing/built-renderer.ts'
import { snapshot } from '#src/testing/snapshot.ts'
import { testTarget } from '#src/testing/test-target.ts'

const hasWebGL2 = document.createElement('canvas').getContext('webgl2') !== null
const frame = { alpha: 1, frameMs: 16, paused: false }
const BACKGROUND = 0x2e222f
const PALETTE = new Set(DEFAULT_PALETTE.colors.map((hex) => Number.parseInt(hex.slice(1), 16)))

let scope: { dispose(): void } | undefined
afterEach(() => {
  scope?.dispose()
  scope = undefined
  document.body.replaceChildren()
})

async function start(
  look: Look = DEFAULT_LOOK,
): Promise<{ renderer: Pixi3dRenderer; grade: GradeEffect | undefined }> {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const factory = createPixi3dRenderer({
    logicalWidth: 160,
    logicalHeight: 90,
    backgroundColor: BACKGROUND,
    views: {},
    look,
    scene: (view) => {
      view.camera.position.set(0, 0, 5)
      view.camera.lookAt({ x: 0, y: 0, z: 0 })
      view.root.addChild(
        new Mesh3D({ geometry: new CubeGeometry(), material: new FlatMaterial({ baseColor: 0x96b2d9 }) }),
      )
      return undefined
    },
  })
  const renderer = await builtRenderer(factory(testTarget(host, {})))
  scope = renderer
  const grade = renderer.view.passes.find((p): p is GradeEffect => p instanceof GradeEffect)
  return { renderer, grade }
}

function shot(renderer: Pixi3dRenderer): Uint8Array {
  // The first frames after a pass is switched build the render graph again; the picture is the settled one.
  for (let i = 0; i < 4; i++) renderer.draw(frame)
  return Uint8Array.from(snapshot(renderer))
}

describe.runIf(hasWebGL2)('the mood grade on WebGL2', () => {
  it('leaves the frame as it was with no mood, and moves its colours onto other palette colours with one', async () => {
    const { renderer, grade } = await start()
    if (grade === undefined) throw new Error('no grade pass')
    expect(grade.enabled).toBe(false)
    const plain = shot(renderer)
    grade.mood(MOODS.coldDawn)
    expect(grade.enabled).toBe(true)
    const graded = shot(renderer)
    let moved = 0
    for (let i = 0; i < graded.length; i += 4) {
      const colour = ((graded[i] ?? 0) << 16) | ((graded[i + 1] ?? 0) << 8) | (graded[i + 2] ?? 0)
      // Where nothing is drawn the background shows, which is no pass's to snap.
      if (colour !== BACKGROUND) expect(PALETTE.has(colour)).toBe(true)
      if (graded[i] !== plain[i] || graded[i + 1] !== plain[i + 1] || graded[i + 2] !== plain[i + 2]) moved++
    }
    expect(moved).toBeGreaterThan(100)
    grade.mood(undefined)
    expect(shot(renderer)).toEqual(plain)
  })

  // The default look carries the grade (its switch is on) so a game can name a mood later; until it does, the pass is not in the frame.
  it('the default look draws the same frame as one with the grade switched off, pixel for pixel, while no mood is named', async () => {
    const { renderer } = await start()
    const withGrade = shot(renderer)
    scope?.dispose()
    const off = await start(parseLook({ switches: { grade: false } }))
    expect(off.grade).toBeUndefined()
    expect(shot(off.renderer)).toEqual(withGrade)
  })
})
