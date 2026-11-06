<!--
  The level canvas on the page. It loads the level's images from the
  workspace (a missing or broken one draws numbered placeholders, never an error), builds the draw list and draws it
  with Pixi, fitted to its box unless a camera is given. While the WebGL context is lost it says "Preview paused" and
  draws again once the browser gives the context back; without WebGL it says "Preview unavailable" and the rest of the
  editor works. `data-state` (loading, drawn, paused, unavailable) is what the tests and the review images wait on.
  The Level view mounts this and feeds it the controller's view and its viewport's camera.
-->
<script lang="ts">
import { onMount } from 'svelte'
import { createColorResolver } from '../../shared/level-2d/canvas/colors'
import type { DrawView } from '../../shared/level-2d/canvas/draw/draw-list-types'
import { createLevelDrawList } from '../../shared/level-2d/canvas/draw/level-draw-list'
import { levelImages } from '../../shared/level-2d/canvas/draw/level-images'
import {
  type Camera,
  createLevelView,
  fitCamera,
  type LevelView,
} from '../../shared/level-2d/canvas/level-view'
import { createTextureManager } from '../../shared/level-2d/canvas/textures.manager'
import type { Project, Size } from '../../shared/level-2d/model/project-types'

interface Props {
  project: Project
  view: DrawView
  /** Reads a workspace file's bytes (the workspace store's `read`). */
  read: (path: string) => Promise<Uint8Array | undefined>
  /** Where the level sits; the whole level, fitted and centred, when absent. */
  camera?: Camera | undefined
}

const { project, view, read, camera }: Props = $props()

let host = $state<HTMLElement>()
let canvas = $state<HTMLCanvasElement>()
let levelView = $state.raw<LevelView | undefined>(undefined)
let unavailable = $state(false)
let paused = $state(false)
let drawn = $state(false)
/** The box in CSS pixels and the device pixels per CSS pixel. */
type Box = Size & { readonly resolution: number }
let size = $state.raw<Box>({ w: 1, h: 1, resolution: 1 })
/** The size the renderer was made or last resized at. */
let drawnAt: Box = { w: 1, h: 1, resolution: 1 }
/** The image list whose load has finished: the draw waits for the level's own. */
let readyImages = $state<string | undefined>(undefined)

const textures = createTextureManager({ read: (path) => read(path) })
const drawList = createLevelDrawList()
const images = $derived(levelImages(project, view.level).join('\n'))
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
  void createLevelView({
    canvas: target,
    textures,
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
      levelView = created
    }
  })
  // Only the box is measured here; the draw below resizes the renderer and draws once at the new size.
  const observer = new page.ResizeObserver(() => {
    size = measure()
  })
  observer.observe(element)
  return () => {
    disposed = true
    observer.disconnect()
    stopPaused?.()
    levelView?.destroy()
    textures.destroy()
  }
})

// Loading runs only when the level's image list changes, so a pointer moving over the canvas never reads a file.
$effect(() => {
  const wanted = images
  let stale = false
  drawn = false
  void textures.load(wanted === '' ? [] : wanted.split('\n')).then(() => {
    if (!stale) readyImages = wanted
  })
  return () => {
    stale = true
  }
})

// Drawing is synchronous once the images are in: every change of the project, the view, the camera or the box, once
// each. A new box resizes the renderer first (which draws nothing), so a resize is one draw at the new size.
$effect(() => {
  const current = levelView
  const box = size
  if (current === undefined || readyImages !== images) return
  if (box !== drawnAt) {
    current.resize(box.w, box.h, box.resolution)
    drawnAt = box
  }
  const list = drawList({ project, view, images: textures.loaded, generations: textures.generations })
  current.render(list, camera ?? fitCamera(list.size, box))
  drawn = true
})
</script>

<div class="level-canvas" data-level-canvas data-state={phase} bind:this={host}>
  <!-- Chromium paints a lost canvas white with a broken-image glyph, so it is hidden while there is no picture. -->
  <canvas bind:this={canvas} class:hidden={paused || unavailable}></canvas>
  <p class="notice" role="status" hidden={message === ''}>{message}</p>
</div>

<style>
  /* It fills the box its parent gives it (the Level view's canvas region). */
  .level-canvas {
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
    border-radius: var(--edge);
    background: var(--color-bg-raised);
    color: var(--color-text-primary);
    font: var(--text-body-13);
  }
  .notice[hidden] {
    display: none;
  }
</style>
