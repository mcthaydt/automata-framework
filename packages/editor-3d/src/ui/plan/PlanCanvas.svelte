<!--
  The Plan view's canvas (ED3D.5d; ED3D spec §5.3 flows 2 and 3, §6, §10, §11). It measures its box, makes the
  renderer at that size (a factory, so the DOM tests pass a fake), frames the level once, and draws the editor's plan
  again whenever the level, the selection, the view or the Select tool's state changes. The kit's gesture recogniser
  feeds the Select tool (`plan-gestures.ts`); a Pencil never pans. Rulers along the top and left are text over the
  canvas. When the page cannot draw (no WebGL2) or the GPU drops the context, a notice says so in plain words, says the
  level is safe, and offers Try again, which makes a new canvas and renderer; the level, its history and the selection
  never hear of it. A resize or a rotation keeps the camera's centre and remounts nothing.
-->
<script lang="ts">
import { attachGestures } from '@mcthaydt/automata-editor-kit'
import type { Size } from '@mcthaydt/automata-editor-kit/core'
import { onDestroy } from 'svelte'
import { createPlanController, type PlanController } from '../../app/plan-controller'
import { createPlanPicture } from '../../app/plan-picture'
import type { Point } from '../../format/sector.schema'
import type { LevelEditor } from '../../model/level-editor'
import type { PlanPaint } from '../../view/plan/plan-paint'
import { planViewport, toWorld } from '../../view/plan/plan-viewport'
import { planGestures } from './plan-gestures'
import type { PlanRenderer, PlanRendererFactory } from './plan-renderer'

interface Props {
  editor: LevelEditor<unknown>
  renderer: PlanRendererFactory
  onundo: () => void
  onredo: () => void
  /** Where the pointer is on the plan, in metres; `undefined` once it leaves. */
  onpointer?: ((at: Point | undefined) => void) | undefined
}

const { editor, renderer: makeRenderer, onundo, onredo, onpointer }: Props = $props()

type Phase = 'starting' | 'drawing' | 'unavailable'

let host = $state<HTMLElement>()
let canvas = $state<HTMLCanvasElement>()
let phase = $state<Phase>('starting')
let paused = $state(false)
/** Bumped by Try again: a new canvas element, since one that refused WebGL2 will not give it later. */
let attempt = $state(0)
let rulers = $state.raw<PlanPaint['rulers']>({ x: [], z: [] })

let size: Size | undefined
let controller: PlanController | undefined
let view: PlanRenderer | undefined
const stops: (() => void)[] = []
// svelte-ignore state_referenced_locally
const picture = createPlanPicture(editor)

function draw(): void {
  if (size === undefined || view === undefined) return
  const paint = picture(size)
  rulers = paint.rulers
  view.draw(paint)
}

/** The first measure makes the controller and frames the level; every measure resizes. */
function measured(next: Size): void {
  if (next.w <= 0 || next.h <= 0) return
  const first = size === undefined
  size = next
  if (first) {
    controller = createPlanController(editor, next)
    controller.fit()
    stops.push(controller.subscribe(draw))
    stops.push(editor.history.subscribe(draw), editor.selection.subscribe(draw), editor.view.subscribe(draw))
    if (host !== undefined) {
      const handlers = planGestures(controller, { onundo, onredo })
      const hover = handlers.hover
      handlers.hover = (event) => {
        hover?.(event)
        onpointer?.(toWorld(planViewport(editor.view.state.camera, next), event))
      }
      stops.push(attachGestures(host, handlers))
    }
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

// A new canvas element after Try again: start once it is in the page.
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
  class="plan"
  bind:this={host}
  data-testid="plan-canvas"
  data-phase={phase}
  role="application"
  aria-label="Plan"
  aria-roledescription="level plan"
  onpointerleave={() => {
    controller?.leave()
    onpointer?.(undefined)
  }}
>
  {#key attempt}
    <canvas bind:this={canvas} class:hidden={phase !== 'drawing' || paused}></canvas>
  {/key}
  <div class="ruler top" aria-hidden="true">
    {#each rulers.x as tick (tick.at)}<span style:left={`${tick.at}px`}>{tick.label}</span>{/each}
  </div>
  <div class="ruler left" aria-hidden="true">
    {#each rulers.z as tick (tick.at)}<span style:top={`${tick.at}px`}>{tick.label}</span>{/each}
  </div>
  <div class="notice" role="status" hidden={phase !== 'unavailable' && !paused}>
    {#if phase === 'unavailable'}
      <p>This browser can’t draw the plan: it needs WebGL2. Your level is safe. Try again, or open it in Safari or Chrome.</p>
      <button type="button" onclick={tryAgain}>Try again</button>
    {:else if paused}
      <p>The plan stopped drawing. Your level is safe.</p>
      <button type="button" onclick={tryAgain}>Try again</button>
    {/if}
  </div>
</div>

<style>
  .plan {
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
  .ruler {
    position: absolute;
    pointer-events: none;
    color: var(--color-text-dim);
    font: 500 10px / 12px var(--font-mono, monospace);
  }
  .ruler.top {
    top: 2px;
    left: 0;
    right: 0;
    height: 12px;
  }
  .ruler.top span {
    position: absolute;
    transform: translateX(3px);
  }
  .ruler.left {
    top: 0;
    bottom: 0;
    left: 2px;
    width: 24px;
  }
  .ruler.left span {
    position: absolute;
    transform: translateY(2px);
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
