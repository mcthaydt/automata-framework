<!--
  The Dollhouse view's canvas (ED3D.5e; ED3D spec §6, §10, §11 / ED3-p). It measures its box, makes the renderer at
  that size (a factory, so the DOM tests pass a fake), and draws the level's mesh through the orbit camera whenever the
  level, the selection or the orbit changes. The kit's gestures feed the dollhouse controller (`dollhouse-gestures.ts`),
  with the pinch's twist on. When the page cannot draw (no WebGL2) or the GPU drops the context, a notice says so, says
  the plan still works and the level is safe, and offers Try again; the plan beside it never hears of it.
-->
<script lang="ts">
import { attachGestures } from '@automata/editor/kit'
import type { Size } from '@automata/editor/kit/core'
import { onDestroy } from 'svelte'
import type { LevelEditor } from '../../../shared/edit/level-editor'
import { cardClearArea } from './card-clear-area'
import { createDollhouseController, type DollhouseController } from './dollhouse-controller'
import { dollhouseGestures } from './dollhouse-gestures'
import { dollhousePaint, type SurfaceColours } from './dollhouse-paint'
import type { DollhouseRenderer, DollhouseRendererFactory } from './dollhouse-renderer'
import type { GameScene } from './game-scene'

interface Props {
  editor: LevelEditor<unknown>
  renderer: DollhouseRendererFactory
  /** The game's colour for a material by name; without it every surface keeps the blockout's grey. */
  colours?: SurfaceColours | undefined
  /** The level as the game draws it (`createSceneCache`); without it, or for a level it cannot build, the flat blockout. */
  scene?: (() => GameScene | undefined) | undefined
  onundo: () => void
  onredo: () => void
}

const { editor, renderer: makeRenderer, colours, scene, onundo, onredo }: Props = $props()

type Phase = 'starting' | 'drawing' | 'unavailable'

let host = $state<HTMLElement>()
let canvas = $state<HTMLCanvasElement>()
let phase = $state<Phase>('starting')
let paused = $state(false)
let attempt = $state(0)

let size: Size | undefined
let controller: DollhouseController | undefined
let view: DollhouseRenderer | undefined
const stops: (() => void)[] = []

function draw(): void {
  if (size === undefined || view === undefined || controller === undefined) return
  const { mesh, orbit } = controller.view
  view.draw(dollhousePaint(mesh, orbit, size, new Set(editor.selection.ids), colours, scene?.()))
}

function measured(next: Size): void {
  if (next.w <= 0 || next.h <= 0) return
  const first = size === undefined
  size = next
  if (first) {
    controller = createDollhouseController(editor, next)
    // A change that moves a prop, a thing or the time of day leaves the rooms' mesh alone, so the history is heard too.
    stops.push(controller.subscribe(draw), editor.selection.subscribe(draw), editor.history.subscribe(draw))
    if (host !== undefined)
      stops.push(attachGestures(host, dollhouseGestures(controller, { onundo, onredo }), { rotate: true }))
  } else controller?.resize(next)
  clearArea()
  if (view === undefined) void start()
  else {
    view.resize({ ...next, resolution: resolution() })
    draw()
  }
}

const resolution = (): number => host?.ownerDocument.defaultView?.devicePixelRatio ?? 1

/** The room is framed where the details card (or a sheet) does not cover it, and again when the card opens or moves. */
function clearArea(): void {
  if (host !== undefined && size !== undefined) controller?.setUsable(cardClearArea(host, size))
}

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

$effect(() => {
  const document = host?.ownerDocument
  const Observer = document?.defaultView?.MutationObserver
  if (document === undefined || Observer === undefined) return
  const observer = new Observer(clearArea)
  observer.observe(document.body, {
    subtree: true,
    attributes: true,
    attributeFilter: ['data-open', 'data-detent', 'data-presentation'],
  })
  return () => observer.disconnect()
})

onDestroy(() => {
  for (const stop of stops.splice(0)) stop()
  controller?.dispose()
  view?.destroy()
})
</script>

<div
  class="dollhouse"
  bind:this={host}
  data-testid="dollhouse-canvas"
  data-phase={phase}
  role="application"
  aria-label="3D view"
  aria-roledescription="3D view of the rooms"
>
  {#key attempt}
    <canvas bind:this={canvas} class:hidden={phase !== 'drawing' || paused}></canvas>
  {/key}
  <span class="tag" aria-hidden="true">Drag to turn the room</span>
  <div class="notice" role="status" hidden={phase !== 'unavailable' && !paused}>
    {#if phase === 'unavailable'}
      <p>This browser can’t draw the 3D view: it needs WebGL2. The plan still works and your level is safe.</p>
      <button type="button" onclick={tryAgain}>Try again</button>
    {:else if paused}
      <p>The 3D view stopped drawing. The plan still works and your level is safe.</p>
      <button type="button" onclick={tryAgain}>Try again</button>
    {/if}
  </div>
</div>

<style>
  .dollhouse {
    position: relative;
    width: 100%;
    height: 100%;
    min-height: 0;
    overflow: hidden;
    background: #0c0d10;
    touch-action: none;
  }
  canvas {
    display: block;
    width: 100%;
    height: 100%;
    /* The game's picture is a small field of pixels scaled up whole. */
    image-rendering: pixelated;
  }
  canvas.hidden {
    visibility: hidden;
  }
  .tag {
    position: absolute;
    top: var(--space-2);
    left: var(--space-2);
    padding: 2px 8px;
    border-radius: var(--edge-sm);
    background: color-mix(in srgb, var(--color-bg-app) 85%, transparent);
    color: var(--color-text-dim);
    font: var(--text-body-13);
    pointer-events: none;
  }
  .notice {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--space-3);
    padding: var(--space-5);
    text-align: center;
    color: var(--color-text-primary);
    font: var(--text-body-13);
  }
  .notice[hidden] {
    display: none;
  }
  .notice p {
    max-width: 40ch;
    margin: 0;
  }
  .notice button {
    min-width: 48px;
    min-height: 48px;
    padding: 0 var(--space-4);
    border: 1px solid var(--color-border-strong);
    border-radius: var(--edge-lg);
    background: var(--color-bg-raised);
    color: var(--color-text-primary);
    font: var(--text-label-12);
    cursor: pointer;
  }
</style>
