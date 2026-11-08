<!--
  The Walk view's canvas (ED3D.8b; ED3D spec §5.3 flow 4, §6, §10, §11 / ED3-p). It measures its box, makes the renderer at
  that size (the dollhouse's, a factory so the DOM tests pass a fake), and draws the level's mesh through the walker's eye
  whenever the level, the selection or the eye changes. The walk controller moves the eye on the frame clock from the sticks
  and the keys (W A S D with Q and E, which the view keeps from the editor's own shortcuts while it has the focus); the
  kit's gestures look and pick (`walk-gestures.ts`). A tap selects through the editor's one selection, so the plan shows
  the wall Walk picked and a change made in the inspector shows in both (ED3-f). Without WebGL2, or after the context is
  lost, a notice says the plan still works and the level is safe, and offers Try again.
-->
<script lang="ts">
import { attachGestures } from '@automata/editor/kit'
import type { Size } from '@automata/editor/kit/core'
import { onDestroy } from 'svelte'
import type { LevelEditor } from '../../../shared/edit/level-editor'
import { createGeometryCache } from '../../../shared/geometry/geometry-cache'
import { meshPaint } from '../dollhouse/dollhouse-paint'
import type { DollhouseRenderer, DollhouseRendererFactory } from '../dollhouse/dollhouse-renderer'
import type { Frames } from './frames'
import WalkHud from './WalkHud.svelte'
import { walkGestures } from './walk-gestures'
import { aimWords, type Minimap, minimapOf } from './walk-hud'
import { createWalkController, type WalkController, type WalkMode, type WalkView } from './walk-session'

interface Props {
  editor: LevelEditor<unknown>
  renderer: DollhouseRendererFactory
  frames: Frames
  onundo: () => void
  onredo: () => void
  /** What the status line says while Walk is shown: the warning, else what the crosshair is on. */
  onwords: (words: string | undefined) => void
}

const { editor, renderer: makeRenderer, frames, onundo, onredo, onwords }: Props = $props()

type Phase = 'starting' | 'drawing' | 'unavailable'

let host = $state<HTMLElement>()
let canvas = $state<HTMLCanvasElement>()
let phase = $state<Phase>('starting')
let paused = $state(false)
let attempt = $state(0)
let walk = $state.raw<WalkController | undefined>()
let shown = $state.raw<WalkView | undefined>()
let boxed = $state.raw<Size>({ w: 120, h: 90 })

let size: Size | undefined
let view: DollhouseRenderer | undefined
// svelte-ignore state_referenced_locally
const geometry = createGeometryCache(editor)
const stops: (() => void)[] = []

const minimap: Minimap | undefined = $derived(
  shown === undefined ? undefined : minimapOf(geometry().layers, shown.camera, boxed),
)
const words = $derived(shown === undefined ? '' : (shown.warning ?? aimWords(shown.aim)))

$effect(() => {
  onwords(shown === undefined ? undefined : (shown.warning ?? aimWords(shown.aim)))
})

function draw(): void {
  if (size === undefined || view === undefined || walk === undefined) return
  shown = walk.view
  view.draw(meshPaint(walk.mesh, walk.view.camera, size, new Set(editor.selection.ids)))
}

function measured(next: Size): void {
  if (next.w <= 0 || next.h <= 0) return
  const first = size === undefined
  size = next
  if (first) {
    walk = createWalkController(editor, next)
    shown = walk.view
    stops.push(walk.subscribe(draw), editor.selection.subscribe(draw))
    if (host !== undefined) stops.push(attachGestures(host, walkGestures(walk, { onundo, onredo })))
  } else walk?.resize(next)
  if (view === undefined) void start()
  else {
    view.resize({ ...next, resolution: resolution() })
    draw()
  }
}

const resolution = (): number => host?.ownerDocument.defaultView?.devicePixelRatio ?? 1

let starting = false
async function start(): Promise<void> {
  if (starting || size === undefined || canvas === undefined) return
  starting = true
  const made = await makeRenderer(canvas, { ...size, resolution: resolution() })
  starting = false
  if (made === undefined) {
    phase = 'unavailable'
    return
  }
  view = made
  stops.push(made.paused.subscribe((value) => (paused = value)))
  phase = 'drawing'
  draw()
}

function tryAgain(): void {
  view?.destroy()
  view = undefined
  paused = false
  phase = 'starting'
  attempt += 1
}

$effect(() => {
  void attempt
  if (canvas !== undefined && view === undefined && size !== undefined) void start()
})

$effect(() => {
  if (host === undefined) return
  const Observer = host.ownerDocument.defaultView?.ResizeObserver
  if (Observer === undefined) return
  const observer = new Observer((entries) => {
    const box = entries[0]?.contentRect
    if (box !== undefined) measured({ w: Math.round(box.width), h: Math.round(box.height) })
  })
  observer.observe(host)
  return () => observer.disconnect()
})

// The eye moves on the frame clock: the controller steps by the seconds since the last frame.
$effect(() => {
  const current = walk
  if (current === undefined) return
  let last: number | undefined
  let handle = 0
  const step = (seconds: number): void => {
    if (last !== undefined) current.tick(seconds - last)
    last = seconds
    handle = frames.request(step)
  }
  handle = frames.request(step)
  return () => frames.cancel(handle)
})

// W A S D and Q E walk while the view has the focus; the editor's own shortcuts (D is the Door tool) hear nothing of them.
function key(event: KeyboardEvent, down: boolean): void {
  if (event.ctrlKey || event.metaKey || event.altKey) return
  if (walk?.key(event.code, down) === true) {
    event.preventDefault()
    event.stopPropagation()
  }
}

onDestroy(() => {
  for (const stop of stops.splice(0)) stop()
  walk?.dispose()
  view?.destroy()
})

const setMode = (mode: WalkMode): void => walk?.setMode(mode)
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions: the view takes the focus so W A S D and Q E walk -->
<div
  class="walk"
  bind:this={host}
  data-testid="walk-canvas"
  data-phase={phase}
  data-mode={shown?.mode ?? 'walk'}
  role="application"
  aria-label="Walk view"
  aria-roledescription="first-person view of the rooms"
  tabindex="0"
  onkeydown={(event) => key(event, true)}
  onkeyup={(event) => key(event, false)}
  onblur={() => {
    for (const code of ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE']) walk?.key(code, false)
  }}
>
  {#key attempt}
    <canvas bind:this={canvas} class:hidden={phase !== 'drawing' || paused}></canvas>
  {/key}
  {#if shown !== undefined && minimap !== undefined && phase === 'drawing' && !paused}
    <WalkHud
      view={shown}
      {minimap}
      {words}
      onmode={setMode}
      onstick={(which, tilt) => walk?.stick(which, tilt)}
      onlift={(amount) => walk?.lift(amount)}
    />
  {/if}
  <div class="notice" role="status" hidden={phase !== 'unavailable' && !paused}>
    {#if phase === 'unavailable'}
      <p>This browser can’t draw the Walk view: it needs WebGL2. The plan still works and your level is safe.</p>
      <button type="button" onclick={tryAgain}>Try again</button>
    {:else if paused}
      <p>The Walk view stopped drawing. The plan still works and your level is safe.</p>
      <button type="button" onclick={tryAgain}>Try again</button>
    {/if}
  </div>
</div>

<style>
  .walk {
    position: relative;
    width: 100%;
    height: 100%;
    min-height: 0;
    overflow: hidden;
    background: #0c0d10;
    touch-action: none;
    outline: none;
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
    inset: 0;
    display: grid;
    place-content: center;
    gap: var(--space-3);
    padding: var(--space-5);
    background: #0c0d10;
    color: var(--color-text-dim);
    font: var(--text-body-13);
    text-align: center;
  }
  .notice[hidden] {
    display: none;
  }
  .notice p {
    margin: 0;
  }
  .notice button {
    min-height: 48px;
    padding: 0 var(--space-4);
    border: 1px solid var(--stage-line);
    border-radius: var(--edge-lg);
    background: transparent;
    color: var(--color-text-primary);
    font: inherit;
  }
</style>
