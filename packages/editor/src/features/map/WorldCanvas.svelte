<!--
  The World view's map on the page: the world's levels drawn by Pixi at the camera the view fits,
  each with its picture: the images every level uses are loaded once, and each level keeps its own draw list
  maker so an unchanged level reuses what it drew.
  While the WebGL context is lost it says "Preview paused" and draws again once the browser gives it back; without
  WebGL it says "Preview unavailable" and the rest of the view (the list, the inspector) still works. `data-state`
  (loading, drawn, paused, unavailable) is what the tests and the review images wait on.
-->
<script lang="ts">
import { onMount } from 'svelte'
import { createColorResolver } from '../../shared/level-2d/canvas/colors'
import type { LevelDrawList } from '../../shared/level-2d/canvas/draw/draw-list-types'
import { createLevelDrawList } from '../../shared/level-2d/canvas/draw/level-draw-list'
import { levelImages } from '../../shared/level-2d/canvas/draw/level-images'
import { plainDrawView } from '../../shared/level-2d/canvas/level-thumbnails'
import { createTextureManager } from '../../shared/level-2d/canvas/textures.manager'
import { createWorldView, type WorldView } from '../../shared/level-2d/canvas/world-view'
import type { Size } from '../../shared/level-2d/model/project-types'
import type { WorldCanvasProps } from '../document/view-props'

const { project, read, rects, camera, links }: WorldCanvasProps = $props()

const textures = createTextureManager({ read: (path) => read(path) })
const drawers = new Map<string, ReturnType<typeof createLevelDrawList>>()
/** The image list whose load has finished: pictures wait for it, so a level never flashes placeholders first. */
let readyImages = $state<string | undefined>(undefined)
const images = $derived(
  [...new Set(project.levels.flatMap((level) => levelImages(project, level.id)))].sort().join('\n'),
)
$effect(() => {
  const wanted = images
  void textures.load(wanted === '' ? [] : wanted.split('\n')).then(() => (readyImages = wanted))
})
const pictures = $derived.by((): ReadonlyMap<string, LevelDrawList> => {
  if (readyImages !== images) return new Map()
  const drawn = new Map<string, LevelDrawList>()
  for (const rect of rects) {
    let drawer = drawers.get(rect.id)
    if (drawer === undefined) {
      drawer = createLevelDrawList()
      drawers.set(rect.id, drawer)
    }
    drawn.set(
      rect.id,
      drawer({
        project,
        view: plainDrawView(rect.id),
        images: textures.loaded,
        generations: textures.generations,
      }),
    )
  }
  return drawn
})

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
    textures,
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
    textures.destroy()
  }
})

// One draw for every change of the levels, their links, the camera or the box; a new box resizes the renderer first.
$effect(() => {
  const current = worldView
  const box = size
  if (current === undefined) return
  if (box !== drawnAt) {
    current.resize(box.w, box.h, box.resolution)
    drawnAt = box
  }
  current.render(rects, camera, links, pictures)
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
