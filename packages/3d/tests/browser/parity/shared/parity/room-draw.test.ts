// The rooms a view draws, on a real WebGL2 context: changing which rooms are shown hides and shows the right floors in one
// frame, and a hidden room's pixels are the background's, not the room's. The three floors are three flat colours under full
// ambient light, so a room's presence is a count of its colour on the screen. Headless Firefox here has no WebGL, so these skip.
import '#src/entries/no-eval.ts'
import { afterEach, describe, expect, it } from 'vitest'
import { createPixi3dRenderer, type Pixi3dRenderer } from '#src/app/create-renderer.ts'
import { drawWorld, type WorldView } from '#src/app/world-view.ts'
import { buildWorld } from '#src/features/world/build.ts'
import type { AfSector2 } from '#src/shared/level/af-sector-2.schema.ts'
import { sceneLightingSchema } from '#src/shared/render/light/scene-lighting.schema.ts'
import { builtRenderer } from '#src/testing/built-renderer.ts'
import { snapshot } from '#src/testing/snapshot.ts'
import { testTarget } from '#src/testing/test-target.ts'

const hasWebGL2 = document.createElement('canvas').getContext('webgl2') !== null
const WIDTH = 240
const HEIGHT = 120
const frame = { alpha: 1, frameMs: 16, paused: false }
const FLOORS: Record<string, number> = { floorA: 0xff0000, floorB: 0x00ff00, floorC: 0x0000ff }

const room = (id: string, x0: number, surface: string) => ({
  id,
  floor: { z: 0, surface },
  ceiling: { z: 3 },
  light: 1,
  corners: [
    [x0, 0],
    [x0 + 4, 0],
    [x0 + 4, 4],
    [x0, 4],
  ] as [number, number][],
})
const level: AfSector2 = {
  format: 'af-sector/2',
  name: 't',
  sectors: [room('a', 0, 'floorA'), room('b', 4, 'floorB'), room('c', 8, 'floorC')],
}
const LIB = {
  swatches: {
    ...Object.fromEntries(Object.keys(FLOORS).map((name) => [name, {}])),
    plasterWarm: {},
    trimWhite: {},
  },
}

let scope: { dispose(): void } | undefined
afterEach(() => {
  scope?.dispose()
  scope = undefined
  document.body.replaceChildren()
})

/** How many pixels are this colour, to a step of 3 a channel. */
function count(pixels: ArrayLike<number>, colour: number): number {
  const [r, g, b] = [(colour >> 16) & 255, (colour >> 8) & 255, colour & 255]
  let n = 0
  for (let i = 0; i < pixels.length; i += 4)
    if (
      Math.abs((pixels[i] ?? 0) - r) <= 3 &&
      Math.abs((pixels[i + 1] ?? 0) - g) <= 3 &&
      Math.abs((pixels[i + 2] ?? 0) - b) <= 3
    )
      n++
  return n
}

async function start(): Promise<{ renderer: Pixi3dRenderer; world: () => WorldView }> {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const built = buildWorld(level, LIB)
  let drawn: WorldView | undefined
  const renderer = await builtRenderer(
    createPixi3dRenderer({
      logicalWidth: WIDTH,
      logicalHeight: HEIGHT,
      backgroundColor: 0x000000,
      views: {},
      lighting: sceneLightingSchema.parse({ ambient: 1, colorSpace: 'srgb', lamps: [] }),
      scene: (view, _stage, _occluders, light) => {
        view.camera.fov = 50
        view.camera.position.set(6, 14, 2.01)
        view.camera.lookAt({ x: 6, y: 0, z: 2 })
        drawn = drawWorld(
          { parent: view.root, colourOf: (swatch) => FLOORS[swatch] ?? 0x808080, light },
          built.pieces,
        )
        // Looking down from above, the ceilings would hide the floors.
        for (const piece of built.pieces)
          if (piece.part === 'ceiling') (drawn.mesh(piece.id) as { visible: boolean }).visible = false
        return undefined
      },
    })(testTarget(host)),
  )
  scope = renderer
  return { renderer, world: () => drawn as WorldView }
}

describe.runIf(hasWebGL2)('the rooms a view draws, on WebGL2', () => {
  it('shows every floor with no rooms named, and only the floors of the rooms shown after', async () => {
    const { renderer, world } = await start()
    renderer.draw(frame)
    const all = snapshot(renderer)
    for (const colour of Object.values(FLOORS))
      expect(count(all, colour), colour.toString(16)).toBeGreaterThan(300)

    world().showRooms(new Set(['a']))
    renderer.draw(frame)
    const onlyA = snapshot(renderer)
    expect(count(onlyA, FLOORS.floorA as number)).toBeGreaterThan(300)
    expect(count(onlyA, FLOORS.floorB as number)).toBe(0)
    expect(count(onlyA, FLOORS.floorC as number)).toBe(0)

    // Swapping to the other two, in one frame, hides a and shows b and c.
    world().showRooms(new Set(['b', 'c']))
    renderer.draw(frame)
    const others = snapshot(renderer)
    expect(count(others, FLOORS.floorA as number)).toBe(0)
    expect(count(others, FLOORS.floorB as number)).toBeGreaterThan(300)
    expect(count(others, FLOORS.floorC as number)).toBeGreaterThan(300)

    world().showRooms(undefined)
    renderer.draw(frame)
    expect(count(snapshot(renderer), FLOORS.floorA as number)).toBeGreaterThan(300)
  })
})
