<!--
  The World view's map on the page (plan ED2D.6b step 4): the world's levels drawn by Pixi at the camera the view fits.
  While the WebGL context is lost it says "Preview paused" and draws again once the browser gives it back; without
  WebGL it says "Preview unavailable" and the rest of the view (the list, the inspector) still works. `data-state`
  (loading, drawn, paused, unavailable) is what the tests and the review images wait on.
-->
<script lang="ts">
import { onMount } from 'svelte'
import { createColorResolver } from '../../canvas/colors'
import { createWorldView, type WorldView } from '../../canvas/world-view'
import type { Size } from '../../model/project-types'
import type { WorldCanvasProps } from '../views/view-props'

const { rects, camera }: WorldCanvasProps = $props()

let host = $state<HTMLElement>()
let canvas = $state<HTMLCanvasElement>()
let worldView = $state.raw<WorldView | undefined>(undefined)
let unavailable = $state(false)
let paused = $state(false)
let drawn = $state(false)
type Box = Size & { readonly resolution: number }
let size = $state.raw<Box>({ w: 1, h: 1, resolution: 1 })
let drawnAt: Box = { w: 1, h: 1, resolution: 1 }

const phase = $derived(unavailable ? 'unavailable' : paused ? 'paused' : drawn ? 'drawn' : 'loading')
const message = $derived(unavailable ? 'Preview unavailable' : paused ? 'Preview paused' : '')

onMount(() => {
  const element = host
  const target = canvas
  const page = element?.ownerDocument.defaultView
  if (element === undefined || target === undefined || page === null || page === undefined) return
  const measure = (): Box => ({
    w: Math.max(1, element.clientWidth),
    h: Math.max(1, element.clientHeight),
    resolution: page.devicePixelRatio,
  })
  size = measure()
  drawnAt = size
  let disposed = false
  let stopPaused: (() => void) | undefined
  const colors = createColorResolver((name) => page.getComputedStyle(element).getPropertyValue(name))
  void createWorldView({
    canvas: target,
    colors,
    width: size.w,
    height: size.h,
    resolution: size.resolution,
  }).then((created) => {
    if (disposed) return created?.destroy()
    if (created === undefined) unavailable = true
    else {
      stopPaused = created.paused.subscribe((value) => {
        paused = value
      })
      worldView = created
    }
  })
  // jsdom has no ResizeObserver; the map then keeps the size it was first measured at.
  const observer =
    page.ResizeObserver === undefined
      ? undefined
      : new page.ResizeObserver(() => {
          size = measure()
        })
  observer?.observe(element)
  return () => {
    disposed = true
    observer?.disconnect()
    stopPaused?.()
    worldView?.destroy()
  }
})

// One draw for every change of the levels, the camera or the box; a new box resizes the renderer first.
$effect(() => {
  const current = worldView
  const box = size
  if (current === undefined) return
  if (box !== drawnAt) {
    current.resize(box.w, box.h, box.resolution)
    drawnAt = box
  }
  current.render(rects, camera)
  drawn = true
})
</script>

<div class="world-canvas" data-world-canvas data-state={phase} bind:this={host}>
  <!-- Chromium paints a lost canvas white with a broken-image glyph, so it is hidden while there is no picture. -->
  <canvas bind:this={canvas} class:hidden={paused || unavailable}></canvas>
  <p class="notice" role="status" hidden={message === ''}>{message}</p>
</div>

<style>
  .world-canvas {
    position: relative;
    width: 100%;
    height: 100%;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
    background: var(--color-bg-canvas);
  }
  canvas {
    display: block;
    width: 100%;
    height: 100%;
  }
  canvas.hidden {
    visibility: hidden;
  }
  .notice {
    position: absolute;
    inset: 50% auto auto 50%;
    transform: translate(-50%, -50%);
    margin: 0;
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-md);
    background: var(--color-bg-raised);
    color: var(--color-text-primary);
    font: var(--text-body-13);
  }
  .notice[hidden] {
    display: none;
  }
</style>
