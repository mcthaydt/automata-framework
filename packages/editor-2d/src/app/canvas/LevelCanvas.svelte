<!--
  The level canvas on the page (plan ED2D.4c3b; 2D editor spec §8, §13). It loads the level's images from the
  workspace (a missing or broken one draws numbered placeholders, never an error), builds the draw list and draws it
  with Pixi, fitted to its box unless a camera is given. While the WebGL context is lost it says "Preview paused" and
  draws again once the browser gives the context back; without WebGL it says "Preview unavailable" and the rest of the
  editor works. `data-state` (loading, drawn, paused, unavailable) is what the tests and the review images wait on.
  The Level view of ED2D.4c4a mounts this and feeds it the controller's view and its viewport's camera.
-->
<script lang="ts">
import { onMount } from 'svelte'
import { createColorResolver } from '../../canvas/colors'
import type { DrawView } from '../../canvas/draw/draw-list-types'
import { createLevelDrawList } from '../../canvas/draw/level-draw-list'
import { levelImages } from '../../canvas/draw/level-images'
import { type Camera, createLevelView, fitCamera, type LevelView } from '../../canvas/level-view'
import { createTextureManager } from '../../canvas/textures.manager'
import type { Project, Size } from '../../model/project-types'

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
let size = $state.raw<Size>({ w: 1, h: 1 })
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
  const measure = (): Size => ({ w: Math.max(1, element.clientWidth), h: Math.max(1, element.clientHeight) })
  size = measure()
  let disposed = false
  let stopPaused: (() => void) | undefined
  const colors = createColorResolver((name) => page.getComputedStyle(element).getPropertyValue(name))
  void createLevelView({
    canvas: target,
    textures,
    colors,
    width: size.w,
    height: size.h,
    resolution: page.devicePixelRatio,
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
  const observer = new page.ResizeObserver(() => {
    size = measure()
    levelView?.resize(size.w, size.h, page.devicePixelRatio)
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

// Drawing is synchronous once the images are in: every change of the project, the view, the camera or the box.
$effect(() => {
  const current = levelView
  if (current === undefined || readyImages !== images) return
  const list = drawList({ project, view, images: textures.loaded })
  current.render(list, camera ?? fitCamera(list.size, size))
  drawn = true
})
</script>

<div class="level-canvas" data-level-canvas data-state={phase} bind:this={host}>
  <canvas bind:this={canvas}></canvas>
  <p class="notice" role="status" hidden={message === ''}>{message}</p>
</div>

<style>
  .level-canvas {
    position: relative;
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
