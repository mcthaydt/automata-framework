<!--
  The Dollhouse view's canvas (ED3D.5e; ED3D spec §6, §10, §11 / ED3-p). It measures its box, makes the renderer at
  that size (a factory, so the DOM tests pass a fake), and draws the level's mesh through the orbit camera whenever the
  level, the selection or the orbit changes. The kit's gestures feed the dollhouse controller (`dollhouse-gestures.ts`),
  with the pinch's twist on. When the page cannot draw (no WebGL2) or the GPU drops the context, a notice says so, says
  the plan still works and the level is safe, and offers Try again; the plan beside it never hears of it.
-->
<script lang="ts">
import { attachGestures } from '@mcthaydt/automata-editor-kit'
import type { Size } from '@mcthaydt/automata-editor-kit/core'
import { onDestroy } from 'svelte'
import { createDollhouseController, type DollhouseController } from '../../app/dollhouse-controller'
import { dollhousePaint } from '../../app/dollhouse-paint'
import type { LevelEditor } from '../../model/level-editor'
import { dollhouseGestures } from './dollhouse-gestures'
import type { DollhouseRenderer, DollhouseRendererFactory } from './dollhouse-renderer'

interface Props {
  editor: LevelEditor<unknown>
  renderer: DollhouseRendererFactory
  onundo: () => void
  onredo: () => void
}

const { editor, renderer: makeRenderer, onundo, onredo }: Props = $props()

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
  view.draw(dollhousePaint(mesh, orbit, size, new Set(editor.selection.ids)))
}

function measured(next: Size): void {
  if (next.w <= 0 || next.h <= 0) return
  const first = size === undefined
  size = next
  if (first) {
    controller = createDollhouseController(editor, next)
    stops.push(controller.subscribe(draw), editor.selection.subscribe(draw))
    if (host !== undefined)
      stops.push(attachGestures(host, dollhouseGestures(controller, { onundo, onredo }), { rotate: true }))
  } else controller?.resize(next)
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
  <span class="tag" aria-hidden="true">3D · orbit</span>
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
  }
  canvas.hidden {
    visibility: hidden;
  }
  .tag {
    position: absolute;
    top: var(--space-2);
    left: var(--space-2);
    padding: 2px 8px;
    border-radius: var(--radius-sm, 4px);
    background: color-mix(in srgb, var(--color-bg-app) 85%, transparent);
    color: var(--color-text-dim);
    font: 500 11px / 16px var(--font-mono, monospace);
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
    border-radius: var(--radius-md);
    background: var(--color-bg-raised);
    color: var(--color-text-primary);
    font: var(--text-label-12);
    cursor: pointer;
  }
</style>
