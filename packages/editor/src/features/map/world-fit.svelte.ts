import { untrack } from 'svelte'
import type { Size } from '../../shared/level-2d/model/project-types'
import { uncoveredArea, type WorldRect } from '../../shared/level-2d/model/world/world-model'
import type { WorldCamera } from './world-camera'

// How the Map view keeps its levels in view: it measures the map's box, works out the part of it no floating
// inspector or open sheet covers, and has the camera fit the levels there whenever the box or what covers it changes
// (once a sheet is laid out, and again when its slide ends). The camera itself holds still once the person pans or
// zooms (`world-camera`). Call it while the view is set up (split from `WorldView` in 12.5).

/** jsdom lays nothing out and has no `ResizeObserver`: the map keeps this box there. */
const DEFAULT_BOX: Size = { w: 800, h: 600 }

export interface WorldFitInputs {
  readonly map: () => HTMLElement | undefined
  readonly camera: WorldCamera
  readonly rects: () => readonly WorldRect[]
  /** True in the wide layout, where nothing covers the map. */
  readonly wide: () => boolean
  /** What can open over the map; read so the fit follows each change. */
  readonly covers: () => readonly unknown[]
}

export interface WorldFit {
  readonly box: Size
  /** The part of the map nothing covers; `undefined` means all of it. */
  openArea(): ReturnType<typeof uncoveredArea> | undefined
  /** Fits the levels again once a step that moves every level (a new level, a new layout) has landed. */
  fitAfter(): void
}

const pageBox = (rect: DOMRect) => ({ x: rect.left, y: rect.top, w: rect.width, h: rect.height })
const SHELL = '[data-testid="world-view"]'

export function worldFit({ map, camera, rects, wide, covers }: WorldFitInputs): WorldFit {
  let box = $state.raw<Size>(DEFAULT_BOX)

  function openArea(): ReturnType<typeof uncoveredArea> | undefined {
    const element = map()
    if (element === undefined || wide()) return undefined
    const open = element
      .closest(SHELL)
      ?.querySelectorAll<HTMLElement>(
        '[data-region="panel"][data-open="true"], [data-region="inspector"][data-open="true"]',
      )
    return uncoveredArea(
      pageBox(element.getBoundingClientRect()),
      [...(open ?? [])].map((cover) => pageBox(cover.getBoundingClientRect())),
    )
  }

  $effect(() => {
    const element = map()
    const Observer = element?.ownerDocument.defaultView?.ResizeObserver
    if (element === undefined || Observer === undefined) return
    const observer = new Observer((entries) => {
      const measured = entries[0]?.contentRect
      if (measured !== undefined && measured.width > 0 && measured.height > 0)
        box = { w: Math.round(measured.width), h: Math.round(measured.height) }
    })
    observer.observe(element)
    return () => observer.disconnect()
  })

  // Until the person pans or zooms, the camera fits the levels into the part of the map nothing covers.
  $effect(() => {
    const size = box
    untrack(() => camera.measure(size, rects(), openArea()))
  })

  // The inspector or a sheet opening or closing: measure once it is laid out, and again when its slide ends.
  $effect(() => {
    void [covers(), wide()]
    const element = map()
    const page = element?.ownerDocument.defaultView
    if (element === undefined || page === undefined || page === null) return
    const refit = (): void => untrack(() => camera.measure(box, rects(), openArea()))
    const frame = page.requestAnimationFrame?.(refit)
    const shell = element.closest(SHELL)
    const slid = (event: Event): void => {
      if ((event as TransitionEvent).propertyName === 'transform') refit()
    }
    shell?.addEventListener('transitionend', slid)
    return () => {
      if (frame !== undefined) page.cancelAnimationFrame(frame)
      shell?.removeEventListener('transitionend', slid)
    }
  })

  return {
    get box() {
      return box
    },
    openArea,
    fitAfter: () => queueMicrotask(() => camera.fit(rects(), openArea())),
  }
}
