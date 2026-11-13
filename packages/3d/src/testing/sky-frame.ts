// One frame of core's `SkyEffect` with the camera level, for the tests that ask which way up the sky is (WebGL2 and WebGPU). The sky is
// the first pass; a small cube stands in the middle because a view with nothing in it runs none of its effects.
import { CubeGeometry, FlatMaterial, Mesh3D } from '@pixi/3d'
import { createPixi3dRenderer, type Pixi3dRenderer } from '../app/create-renderer.ts'
import { SkyEffect } from '../features/look/sky-pass.ts'
import { timeOfDay } from '../shared/time-of-day/time-of-day.ts'
import { builtRenderer } from './built-renderer.ts'
import { snapshot } from './snapshot.ts'
import { testTarget } from './test-target.ts'

/** The clear colour behind the view: what a pixel the sky never reached would be. */
export const CLEAR = [0x2e, 0x22, 0x2f] as const

const luma = (c: readonly number[]): number => 0.299 * (c[0] ?? 0) + 0.587 * (c[1] ?? 0) + 0.114 * (c[2] ?? 0)

/** A pixel well above the horizon and one well below it, and the day's haze colour's luma. */
export interface SkyFrame {
  readonly high: readonly number[]
  readonly low: readonly number[]
  readonly hazeLuma: number
}

/** Draws the day's sky level and reads a column of it back with `read` (`snapshot` for WebGL2). */
export async function shootSky(
  preference: 'webgl2' | 'webgpu',
  read: (renderer: Pixi3dRenderer) => ArrayLike<number> = snapshot,
  onBuilt?: (renderer: Pixi3dRenderer) => void,
): Promise<SkyFrame> {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const time = timeOfDay('day')
  const factory = createPixi3dRenderer({
    ...(preference === 'webgpu' ? { preference } : {}),
    logicalWidth: 160,
    logicalHeight: 90,
    backgroundColor: 0x2e222f,
    views: {},
    scene: (view) => {
      view.camera.position.set(0, 1, 5)
      view.camera.lookAt({ x: 0, y: 1, z: 0 })
      view.root.addChild(
        new Mesh3D({
          geometry: new CubeGeometry({ width: 0.2, height: 0.2, depth: 0.2 }),
          material: new FlatMaterial({ baseColor: 0x96b2d9 }),
        }),
      )
      view.passes = [new SkyEffect(time)]
      return undefined
    },
  })
  const renderer = await builtRenderer(factory(testTarget(host, {})))
  try {
    onBuilt?.(renderer)
    for (let i = 0; i < 4; i++) renderer.draw({ alpha: 1, frameMs: 16, paused: false })
    const pixels = read(renderer)
    const canvas = renderer.stage.app.canvas as HTMLCanvasElement
    const [w, h] = [canvas.width, canvas.height]
    const at = (fx: number, fy: number): number[] => {
      const i = (Math.floor(h * fy) * w + Math.floor(w * fx)) * 4
      return [pixels[i] ?? 0, pixels[i + 1] ?? 0, pixels[i + 2] ?? 0]
    }
    const haze = Number.parseInt((time.scene.haze?.colour ?? '#808080').slice(1), 16)
    return {
      high: at(0.25, 0.2),
      low: at(0.25, 0.8),
      hazeLuma: luma([(haze >> 16) & 255, (haze >> 8) & 255, haze & 255]),
    }
  } finally {
    renderer.dispose()
    document.body.replaceChildren()
  }
}

/**
 * What is wrong with `frame`, as sentences; none when the sky drew and is the right way up. Below the horizon is the haze, the level's
 * colour darkened toward the viewer (between half and all of it); above it is the time's bands, which are brighter and bluer.
 */
export function skyMisses({ high, low, hazeLuma }: SkyFrame): string[] {
  const misses: string[] = []
  const same = (a: readonly number[]): boolean => CLEAR.every((c, k) => c === a[k])
  if (same(high)) misses.push(`a pixel above the horizon is the clear colour (${high}): the sky did not draw`)
  if (same(low)) misses.push(`a pixel below the horizon is the clear colour (${low}): the haze did not draw`)
  if (luma(low) > hazeLuma + 6 || luma(low) < hazeLuma * 0.4)
    misses.push(
      `below the horizon is not the haze (${low}, the haze's luma ${hazeLuma.toFixed(0)}): the sky is upside down`,
    )
  if (Math.abs(luma(high) - luma(low)) < 10)
    misses.push(`above (${high}) and below (${low}) the horizon read alike`)
  return misses
}
