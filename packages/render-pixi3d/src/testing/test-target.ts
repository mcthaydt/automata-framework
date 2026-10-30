// A RenderTarget for the renderer's tests: a fixed usable rectangle, assets from a map, and a bus that records.
import type { RenderTarget } from '@mcthaydt/automata-runtime'

type Geometry = RenderTarget['geometry']['geometry']['current']

export interface TestTarget extends RenderTarget {
  /** Every fact published on the bus, in order. */
  readonly facts: { readonly name: string; readonly fact: unknown }[]
}

export function testTarget(
  host: HTMLElement,
  files: Readonly<Record<string, ArrayBuffer>> = {},
  size = { width: 160, height: 90 },
): TestTarget {
  const geometry: Geometry = {
    usable: { x: 0, y: 0, ...size },
    formFactor: 'desktop',
    layout: { ...size },
    heightTier: undefined,
    insets: { top: 0, right: 0, bottom: 0, left: 0 },
    hostReserved: { left: 0, right: 0 },
    visualInsetBottom: 0,
    hiddenBarBottom: 0,
    keyboardResize: 0,
    visible: { x: 0, y: 0, ...size },
    scale: 1,
  }
  const facts: { name: string; fact: unknown }[] = []
  return {
    host,
    geometry: {
      geometry: { current: geometry },
      onChange: () => () => {},
      setHostDisplay: () => {},
      remeasure: () => {},
      dispose: () => {},
    } as RenderTarget['geometry'],
    assets: { get: (path) => (files[path] === undefined ? undefined : new Blob([files[path]])) },
    bus: {
      publish: (name, fact) => void facts.push({ name, fact }),
      subscribe: () => () => {},
    },
    facts,
  }
}
