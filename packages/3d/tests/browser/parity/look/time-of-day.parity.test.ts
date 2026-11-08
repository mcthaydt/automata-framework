// A time of day lights what the game drew by day (the renderer's `time` option), on a real WebGL2 context: the same
// room is darker at night, golden at golden hour, and the fog and sky move with it, so the picture shows the time a
// level file names and not only its `data-time`.
import '#src/entries/no-eval.ts'
import type { RenderRow, StepResult } from '@automata/sim'
import { afterEach, describe, expect, it } from 'vitest'
import { createPixi3dRenderer } from '#src/app/create-renderer.ts'
import { box } from '#src/shared/render/views/box-view.ts'
import { timeOfDay } from '#src/shared/time-of-day/time-of-day.ts'
import { builtRenderer } from '#src/testing/built-renderer.ts'
import { snapshot } from '#src/testing/snapshot.ts'
import { testTarget } from '#src/testing/test-target.ts'

const hasWebGL2 = document.createElement('canvas').getContext('webgl2') !== null
const frame = { alpha: 1, frameMs: 16, paused: false }
const step = (render: StepResult['render']): StepResult => ({ tick: 0, events: [], render, rejected: [] })
const rows: RenderRow[] = [{ sid: 1, components: { crate: { x: 0, y: 0, z: 0 } } }]

let scope: { dispose(): void } | undefined
afterEach(() => {
  scope?.dispose()
  scope = undefined
  document.body.replaceChildren()
})

/** The mean red, green and blue (0..255) of a frame drawn in `time`; the room is a lit crate under a sky of daylight colours. */
async function meanColour(time: string | undefined): Promise<[number, number, number]> {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const renderer = await builtRenderer(
    createPixi3dRenderer({
      logicalWidth: 80,
      logicalHeight: 45,
      views: { crate: box({ width: 1, height: 1, depth: 1 }, { color: 0xf9c22b }) },
      fog: { near: 5, far: 14, color: 0xcdd2da },
      ...(time !== undefined && { time: timeOfDay(time) }),
      scene: (view) => {
        view.camera.position.set(0, 2.5, 5)
        view.camera.lookAt({ x: 0, y: 0.5, z: 0 })
        // The game draws its colours by day; the renderer lights them.
        view.environment = { skyColor: 0xcdd2da, groundColor: 0x8690b2 }
        return undefined
      },
    })(testTarget(host, {})),
  )
  scope = renderer
  renderer.apply(step({ resync: true, added: rows, changed: [], removed: [] }))
  renderer.draw(frame)
  const pixels = snapshot(renderer)
  const sum = [0, 0, 0]
  for (let i = 0; i < pixels.length; i += 4)
    for (let c = 0; c < 3; c++) sum[c] = (sum[c] ?? 0) + (pixels[i + c] ?? 0)
  const n = pixels.length / 4
  scope.dispose()
  return [(sum[0] ?? 0) / n, (sum[1] ?? 0) / n, (sum[2] ?? 0) / n]
}

describe.runIf(hasWebGL2)('the time of day on WebGL2', () => {
  it('is the picture as it always was when no time is given, or the day', async () => {
    expect(await meanColour('day')).toEqual(await meanColour(undefined))
  })

  it('draws the night darker than the day, and the dusk between them', async () => {
    const sum = (c: number[]) => c[0]! + c[1]! + c[2]!
    const [day, dusk, night] = [await meanColour('day'), await meanColour('dusk'), await meanColour('night')]
    expect(sum(night)).toBeLessThan(sum(dusk))
    expect(sum(dusk)).toBeLessThan(sum(day))
  })

  it('draws golden hour warmer than the day: more red against blue', async () => {
    const [day, golden] = [await meanColour('day'), await meanColour('golden')]
    expect(golden[0]! / golden[2]!).toBeGreaterThan(day[0]! / day[2]!)
  })
})
