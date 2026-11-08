import { createPixiRenderer, type PixiRenderer } from '#src/features/render/renderer.ts'
import type { RenderTarget } from '#src/shared/runtime/render/renderer.ts'
import { classifyFormFactor } from '#src/shared/ui/geometry/form-factor.ts'

export interface Started {
  readonly renderer: PixiRenderer
  /** Moves the view to a new size, as a rotation or a resize does. */
  resize(width: number, height: number): void
}

const open: PixiRenderer[] = []

/** Disposes every renderer the harness started; call it from `afterEach`. */
export function disposeAll(): void {
  for (const renderer of open.splice(0)) renderer.dispose()
}

/**
 * A real renderer on a real WebGL2 context, `view` CSS px wide and high, at device pixel ratio `dpr`, with the
 * logical size a pixel-art game would use. Nothing here waits on a sleep: `draw` renders synchronously.
 */
export async function startRenderer(options: {
  view: { width: number; height: number }
  logical: { width: number; height: number }
  dpr: number
  postFilters?: NonNullable<Parameters<typeof createPixiRenderer>[0]>['postFilters']
}): Promise<Started> {
  Object.defineProperty(window, 'devicePixelRatio', { value: options.dpr, configurable: true })
  let listener: ((g: unknown) => void) | undefined
  const geometry = (width: number, height: number) => ({
    usable: { x: 0, y: 0, width, height },
    formFactor: classifyFormFactor(width, height),
    scale: 1,
  })
  const current = { current: geometry(options.view.width, options.view.height) }
  const target = {
    host: document.body.appendChild(document.createElement('div')),
    geometry: {
      geometry: current,
      onChange: (fn: (g: unknown) => void) => {
        listener = fn
        return () => {}
      },
    },
    assets: { get: () => undefined },
  } as unknown as RenderTarget
  const built = await createPixiRenderer({
    preference: 'webgl',
    logicalWidth: options.logical.width,
    logicalHeight: options.logical.height,
    barColor: 0x000000,
    postFilters: options.postFilters,
  })(target)
  if (!built.ok) throw new Error('the renderer did not start')
  open.push(built.value)
  return {
    renderer: built.value,
    resize(width, height) {
      current.current = geometry(width, height)
      listener?.(current.current)
    },
  }
}

/** The renderer's whole canvas as RGBA after one frame. */
export function frame(renderer: PixiRenderer): { pixels: Uint8ClampedArray; width: number; height: number } {
  renderer.draw({ alpha: 1, frameMs: 16, paused: false })
  const { pixels, width, height } = renderer.stage.app.renderer.extract.pixels({
    target: renderer.stage.app.stage,
  })
  return { pixels: pixels as Uint8ClampedArray, width, height }
}

/** The red, green, blue of the device pixel under CSS px (x, y). */
export function rgbAt(shot: ReturnType<typeof frame>, dpr: number, x: number, y: number): number[] {
  const at = (Math.round(y * dpr) * shot.width + Math.round(x * dpr)) * 4
  return [shot.pixels[at] ?? -1, shot.pixels[at + 1] ?? -1, shot.pixels[at + 2] ?? -1]
}

type Shot = ReturnType<typeof frame>

/** The box of pixels with any ink (white on the black field), in device px, or `undefined` for a blank frame. */
export function inkBox(
  shot: Shot,
): { minX: number; maxX: number; minY: number; maxY: number; pixels: number } | undefined {
  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxX = -1
  let maxY = -1
  let pixels = 0
  for (let y = 0; y < shot.height; y++)
    for (let x = 0; x < shot.width; x++) {
      if ((shot.pixels[(y * shot.width + x) * 4] ?? 0) < 26) continue
      pixels++
      minX = Math.min(minX, x)
      maxX = Math.max(maxX, x)
      minY = Math.min(minY, y)
      maxY = Math.max(maxY, y)
    }
  return pixels === 0 ? undefined : { minX, maxX, minY, maxY, pixels }
}

/**
 * How wide the anti-aliased edge of the first stem is, in device px: on the middle row of the ink, the run of pixels
 * between 10% and 90% white before the stem and after it. A sharp edge is 1 or 2; a texture blown up from a smaller
 * one is as wide as the blow-up.
 */
export function edgeRun(shot: Shot): number {
  const box = inkBox(shot)
  // A frame that is all ink is not text (a bar, a mask drawn white): refuse to call its edge sharp.
  if (!box || box.maxX - box.minX > shot.width / 2) return Number.POSITIVE_INFINITY
  const y = Math.floor((box.minY + box.maxY) / 2)
  const coverage = (x: number): number => (shot.pixels[(y * shot.width + x) * 4] ?? 0) / 255
  let x = box.minX
  while (x <= box.maxX && coverage(x) < 0.1) x++
  let rise = 0
  while (x <= box.maxX && coverage(x) < 0.9) {
    rise++
    x++
  }
  while (x <= box.maxX && coverage(x) >= 0.9) x++
  let fall = 0
  while (x <= box.maxX && coverage(x) >= 0.1) {
    fall++
    x++
  }
  return Math.max(rise, fall)
}
