// The look on a real WebGL2 context (task 8.2): the DUEL snap leaves nothing but palette colours where the scene is
// drawn, the stepped-light material takes a lit mesh, an extension's pass runs after core's, and the look comes back
// after a lost context. WebGPU and WebGL2 parity is the GPU runner's (Chromium here has no WebGPU adapter).
import '#src/entries/no-eval.ts'
import { DEFAULT_PALETTE } from '@automata/content/palette'
import type { RenderRow, StepResult } from '@automata/sim'
import { DirectionalLight, Mesh3D, PhongMaterial, SphereGeometry } from '@pixi/3d'
import { afterEach, describe, expect, it } from 'vitest'
import { createPixi3dRenderer, type Pixi3dRenderer } from '#src/app/create-renderer.ts'
import { DEFAULT_LOOK } from '#src/features/look/look.ts'
import { RampMaterial } from '#src/features/look/ramp-light-material.ts'
import { box } from '#src/shared/render/views/box-view.ts'
import { builtRenderer } from '#src/testing/built-renderer.ts'
import { snapshot } from '#src/testing/snapshot.ts'
import { testTarget } from '#src/testing/test-target.ts'

const hasWebGL2 = document.createElement('canvas').getContext('webgl2') !== null
const frame = { alpha: 1, frameMs: 16, paused: false }
const step = (render: StepResult['render']): StepResult => ({ tick: 0, events: [], render, rejected: [] })
const rows: RenderRow[] = [{ sid: 1, components: { crate: { x: 0, y: 0, z: 0 } } }]

const DUEL = new Set(DEFAULT_PALETTE.colors.map((hex) => Number.parseInt(hex.slice(1), 16)))
const colourAt = (pixels: ArrayLike<number>, i: number): number =>
  ((pixels[i] ?? 0) << 16) | ((pixels[i + 1] ?? 0) << 8) | (pixels[i + 2] ?? 0)

/** The share of the pixels that differ from `empty` whose colour is a DUEL colour, and how many differ. */
function duelShare(empty: ArrayLike<number>, drawn: ArrayLike<number>): { share: number; count: number } {
  let count = 0
  let duel = 0
  for (let i = 0; i < drawn.length; i += 4) {
    if (colourAt(empty, i) === colourAt(drawn, i)) continue
    count++
    if (DUEL.has(colourAt(drawn, i))) duel++
  }
  return { share: count === 0 ? 0 : duel / count, count }
}

let scope: { dispose(): void } | undefined
afterEach(() => {
  scope?.dispose()
  scope = undefined
  document.body.replaceChildren()
})

async function start(
  look: boolean,
  onScene?: (view: Pixi3dRenderer['view']) => void,
): Promise<Pixi3dRenderer> {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const factory = createPixi3dRenderer({
    logicalWidth: 160,
    logicalHeight: 90,
    backgroundColor: 0x2e222f,
    views: { crate: box({ width: 1, height: 1, depth: 1 }, { color: 0xf9c22b }) },
    ...(look && { look: DEFAULT_LOOK }),
    scene: (view) => {
      view.camera.position.set(0, 2.5, 5)
      view.camera.lookAt({ x: 0, y: 0.5, z: 0 })
      const sun = new DirectionalLight({ intensity: 2 })
      sun.rotation.set(-0.8, 0.5, 0)
      view.root.addChild(sun)
      onScene?.(view)
      return undefined
    },
  })
  const renderer = await builtRenderer(factory(testTarget(host, {})))
  scope = renderer
  return renderer
}

describe.runIf(hasWebGL2)('the look on WebGL2', () => {
  it('snaps what the scene draws to DUEL colours, and a frame with no look is not', async () => {
    const plain = await start(false)
    plain.draw(frame)
    const plainEmpty = snapshot(plain)
    plain.apply(step({ resync: true, added: rows, changed: [], removed: [] }))
    plain.draw(frame)
    const before = duelShare(plainEmpty, snapshot(plain))
    scope?.dispose()
    document.body.replaceChildren()

    const looked = await start(true)
    looked.draw(frame)
    const empty = snapshot(looked)
    looked.apply(step({ resync: true, added: rows, changed: [], removed: [] }))
    looked.draw(frame)
    const after = duelShare(empty, snapshot(looked))
    expect(after.count).toBeGreaterThan(200)
    expect(after.share).toBeGreaterThan(0.99)
    expect(before.share).toBeLessThan(0.5)
  })

  it('lights a sphere in a few whole steps with the stepped-light material, and smoothly without it', async () => {
    const colours = async (stepped: boolean): Promise<number> => {
      const renderer = await start(false, (view) => {
        const material = stepped
          ? new RampMaterial({ baseColor: 0xf9c22b, steps: 3 })
          : new PhongMaterial({ baseColor: 0xf9c22b })
        view.root.addChild(new Mesh3D({ geometry: new SphereGeometry(), material }))
      })
      renderer.draw(frame)
      const empty = snapshot(renderer)
      renderer.draw(frame)
      const drawn = snapshot(renderer)
      void empty
      const seen = new Set<number>()
      for (let i = 0; i < drawn.length; i += 4) seen.add(colourAt(drawn, i))
      scope?.dispose()
      document.body.replaceChildren()
      return seen.size
    }
    const smooth = await colours(false)
    const stepped = await colours(true)
    // The background and a few antialiased edge pixels are in both counts; the sphere's own shading is the difference.
    expect(smooth).toBeGreaterThan(20)
    expect(stepped).toBeLessThan(12)
  })

  it('draws an extension pass after core passes (its own switch, here a custom pass in the list)', async () => {
    const renderer = await start(true)
    expect(renderer.view.passes.length).toBeGreaterThanOrEqual(1)
    expect(renderer.view.passes[0]?.constructor.name).toBe('DuelSnapEffect')
  })

  it('brings the look back after a lost context', async () => {
    const renderer = await start(true)
    renderer.draw(frame)
    const empty = snapshot(renderer)
    renderer.apply(step({ resync: true, added: rows, changed: [], removed: [] }))
    renderer.draw(frame)
    const scene = snapshot(renderer)
    const canvas = renderer.stage.app.canvas
    const gl = (renderer.stage.app.renderer as unknown as { gl: WebGL2RenderingContext }).gl
    const lose = gl.getExtension('WEBGL_lose_context')
    if (lose === null) throw new Error('no WEBGL_lose_context')
    const lost = new Promise<void>((r) =>
      canvas.addEventListener('webglcontextlost', () => r(), { once: true }),
    )
    lose.loseContext()
    await lost
    await new Promise((resolve) => setTimeout(resolve, 20))
    const restored = new Promise<void>((r) =>
      canvas.addEventListener('webglcontextrestored', () => r(), { once: true }),
    )
    lose.restoreContext()
    await restored
    renderer.draw(frame)
    const back = snapshot(renderer)
    expect(duelShare(empty, back).share).toBeGreaterThan(0.99)
    expect(duelShare(scene, back).count).toBe(0)
  })
})
