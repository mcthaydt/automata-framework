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
