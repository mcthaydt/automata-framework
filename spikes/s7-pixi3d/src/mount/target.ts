// A RenderTarget for the spike page: the whole window as the usable rectangle, as a game without a host frame has.
// The fields are the ones `createPixiRenderer` reads (packages/render-pixi/src/renderer.ts).

import type { RenderTarget } from '@mcthaydt/automata-runtime'

export function windowTarget(host: HTMLElement): RenderTarget {
  const size = () => ({ width: window.innerWidth, height: window.innerHeight })
  const measureWindow = () => {
    const { width, height } = size()
    return {
      usable: { x: 0, y: 0, width, height },
      formFactor: 'desktop' as const,
      layout: { width, height },
      heightTier: undefined,
      insets: { top: 0, right: 0, bottom: 0, left: 0 },
      hostReserved: { left: 0, right: 0 },
      visualInsetBottom: 0,
      hiddenBarBottom: 0,
      keyboardResize: 0,
      visible: { x: 0, y: 0, width, height },
      scale: 1,
    }
  }
  const current = { current: measureWindow() }
  return {
    host,
    assets: { get: () => undefined },
    geometry: {
      geometry: current,
      onChange(listener: (geometry: ReturnType<typeof measureWindow>) => void) {
        const onResize = () => {
          current.current = measureWindow()
          listener(current.current)
        }
        window.addEventListener('resize', onResize)
        return () => window.removeEventListener('resize', onResize)
      },
      setHostDisplay: () => {},
      remeasure: () => {},
      dispose: () => {},
    },
  } as unknown as RenderTarget
}
