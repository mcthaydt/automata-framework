<!--
  The Plan view's canvas (ED3D.5d; ED3D spec §5.3 flows 2 and 3, §6, §10, §11). It measures its box, makes the
  renderer at that size (a factory, so the DOM tests pass a fake), frames the level once, and draws the editor's plan
  again whenever the level, the selection, the view or the Select tool's state changes. The kit's gesture recogniser
  feeds the Select tool (`plan-gestures.ts`); a Pencil never pans. Rulers along the top and left are text over the
  canvas. When the page cannot draw (no WebGL2) or the GPU drops the context, a notice says so in plain words, says the
  level is safe, and offers Try again, which makes a new canvas and renderer; the level, its history and the selection
  never hear of it. A resize or a rotation keeps the camera's centre and remounts nothing.
  The tools are the frame's (ED3D.6g-a): taps and hovers go to the active one, its overlay is drawn over the plan and
  its edge lengths, refusal and the Sector tool's options are DOM over the canvas.
-->
<script lang="ts">
import { attachGestures } from '@automataframework/automata-editor/kit'
import type { Size } from '@automataframework/automata-editor/kit/core'
import { onDestroy } from 'svelte'
import { loupeOf, nudgePadOf } from '../../app/loupe'
import { createPlanPicture, planPointAt } from '../../app/plan-picture'
import type { PlanToolState, PlanTools } from '../../app/plan-tools'
import { type ToolLabel, toolOverlay } from '../../app/tool-paint'
import type { Point } from '../../format/sector.schema'
import type { LevelEditor } from '../../model/level-editor'
import type { PlanPaint } from '../../view/plan/plan-paint'
import NewSectorCard from './NewSectorCard.svelte'
import NudgePad from './NudgePad.svelte'
import { planGestures } from './plan-gestures'
import type { PlanRenderer, PlanRendererFactory } from './plan-renderer'
import SectorOptions from './SectorOptions.svelte'
import ThingsPalette from './ThingsPalette.svelte'

interface Props {
  editor: LevelEditor<unknown>
  /** The frame's tools: the canvas sizes them, frames the level through Select and forwards the pointer. */
  tools: PlanTools
  /**
   * Whether the New sector card floats over the plan's top right while the Sector tool is chosen (at wide: the frame's
   * choice). Over the plan, not in an inspector column, so choosing the tool never narrows the plan (ED3D.6g-b).
   */
  pointList?: boolean | undefined
  renderer: PlanRendererFactory
  onundo: () => void
  onredo: () => void
  /** Where the pointer is on the plan, in metres; `undefined` once it leaves. */
  onpointer?: ((at: Point | undefined) => void) | undefined
}

const {
  editor,
  tools,
  pointList = false,
  renderer: makeRenderer,
  onundo,
  onredo,
  onpointer,
}: Props = $props()

type Phase = 'starting' | 'drawing' | 'unavailable'

let host = $state<HTMLElement>()
let canvas = $state<HTMLCanvasElement>()
let phase = $state<Phase>('starting')
let paused = $state(false)
/** Bumped by Try again: a new canvas element, since one that refused WebGL2 will not give it later. */
let attempt = $state(0)
let rulers = $state.raw<PlanPaint['rulers']>({ x: [], z: [] })
// svelte-ignore state_referenced_locally
let tool = $state.raw<PlanToolState>(tools.state)
let labels = $state.raw<readonly ToolLabel[]>([])
/** Where the nudge pad sits while it shows (touch or Pencil, corners placed; ED3D.6g-b). */
let pad = $state.raw<'left' | 'right' | undefined>(undefined)

let size: Size | undefined
let view: PlanRenderer | undefined
const stops: (() => void)[] = []
// svelte-ignore state_referenced_locally
const picture = createPlanPicture(editor)

function draw(): void {
  if (size === undefined || view === undefined) return
  const paint = picture(size)
  rulers = paint.rulers
  const overlay = toolOverlay(tool, editor.view.state.camera, size, paint.fills)
  labels = overlay.labels
  pad = nudgePadOf(editor, tools, size)
  view.draw(paint, overlay, loupeOf(editor, tool, size, picture))
}

/** The first measure makes the controller and frames the level; every measure resizes. */
function measured(next: Size): void {
  if (next.w <= 0 || next.h <= 0) return
  const first = size === undefined
  size = next
  if (first) {
    tools.resize(next)
    tools.select.fit()
    stops.push(editor.history.subscribe(draw), editor.selection.subscribe(draw), editor.view.subscribe(draw))
    if (host !== undefined) {
      const handlers = planGestures(tools, { onundo, onredo })
      const hover = handlers.hover
      handlers.hover = (event) => {
        hover?.(event)
        onpointer?.(planPointAt(editor.view.state.camera, next, event))
      }
      stops.push(attachGestures(host, handlers))
    }
  } else tools.resize(next)
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

// The tool's options and refusal show before the first measure too (a page that cannot draw still has them).
$effect(() =>
  tools.subscribe(() => {
    tool = tools.state
    draw()
  }),
)

/**
 * Native listeners, since Svelte delegates `onpointerdown` to the root, by when the canvas's gesture listeners have
 * already had the event.
 */
function keepPresses(element: HTMLElement): () => void {
  const keep = (event: Event): void => event.stopPropagation()
  const types = ['pointerdown', 'pointermove', 'pointerup', 'pointercancel'] as const
  for (const type of types) element.addEventListener(type, keep)
  return () => {
    for (const type of types) element.removeEventListener(type, keep)
  }
}

/** The sentence the active tool refused the last action with, or the one a tap on its target would be refused with. */
const refusal = $derived.by((): string | undefined => {
  if (tool.tool === 'select') return tool.view.refusal
  if ('target' in tool.view && tool.view.target !== undefined && tool.view.target.action === 'none')
    return tool.view.target.reason
  return tool.view.refusal
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
    tools.leave()
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
  <div class="labels" aria-hidden="true">
    {#each labels as label, index (index)}
      {#if label.tone === 'length'}
        <span class="length" style:left={`${label.at.x}px`} style:top={`${label.at.y}px`}>{label.text}</span>
      {/if}
    {/each}
  </div>
  {#if refusal !== undefined}
    <p class="refusal" role="status" data-testid="tool-refusal">{refusal}</p>
  {/if}
  {#if tool.tool === 'things'}
    <div class="controls" {@attach keepPresses}>
      <ThingsPalette
        palette={tool.view.palette}
        active={tool.view.active}
        onpick={(def) => tools.things?.pick(def)}
      />
    </div>
  {/if}
  {#if tool.tool === 'polygon' || tool.tool === 'rectangle' || tool.tool === 'split' || tool.tool === 'merge'}
    <!-- A press on the options is not a tap on the plan under them: the gestures listen on the whole canvas. -->
    <div class="controls" data-pad={pad} {@attach keepPresses}>
    <SectorOptions
      tool={tool.tool}
      corners={tool.tool === 'polygon' || tool.tool === 'rectangle' ? tool.view.corners.length : 0}
      offers={tool.tool === 'polygon' || tool.tool === 'rectangle' ? tool.view.offers : []}
      onshape={(shape) => tools.choose(shape)}
      onundopoint={() => tools.sector?.undoCorner()}
      onclose={() => tools.sector?.close()}
      onaccept={(index) => tools.sector?.acceptOffer(index)}
      ondecline={(index) => tools.sector?.declineOffer(index)}
      onacceptall={() => tools.sector?.acceptAll()}
    />
    {#if pointList && (tool.tool === 'polygon' || tool.tool === 'rectangle')}
      <div class="points">
        <NewSectorCard
          corners={tool.view.corners}
          edges={tool.view.edges}
          closing={tool.view.closing}
          shape={tool.view.shape}
        />
      </div>
    {/if}
    {#if pad !== undefined}
      <NudgePad
        side={pad}
        onnudge={(dx, dz) => tools.sector?.nudge(dx, dz)}
        onclose={() => tools.sector?.close()}
      />
    {/if}
    </div>
  {/if}
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
  .controls {
    display: contents;
  }
  /* Below the sector toolbar's row (12 px down, 56 px tall, then a gap), so a narrow plan never puts it over the shapes. */
  .points {
    position: absolute;
    z-index: 1;
    top: 80px;
    right: var(--space-3);
    width: 248px;
    max-height: calc(100% - 80px - var(--space-3) - 160px);
    overflow-y: auto;
    border: 1px solid var(--color-border-default);
    border-radius: var(--radius-md);
    background: var(--color-bg-surface);
  }
  .labels {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }
  .length {
    position: absolute;
    transform: translate(-50%, -50%);
    padding: 1px 6px;
    border: 1px solid var(--color-accent-default);
    border-radius: 5px;
    background: color-mix(in srgb, var(--color-bg-app) 88%, transparent);
    color: var(--color-accent-default);
    font: 500 11px / 16px var(--font-mono, monospace);
    white-space: nowrap;
  }
  .refusal {
    position: absolute;
    top: 64px;
    left: 50%;
    transform: translateX(-50%);
    max-width: calc(100% - 24px);
    margin: 0;
    padding: var(--space-1) var(--space-3);
    border-radius: var(--radius-md);
    background: var(--color-bg-surface);
    color: var(--color-state-error, #e5534b);
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
    border-radius: var(--radius-md);
    background: var(--color-bg-raised);
    color: var(--color-text-primary);
    font: var(--text-label-12);
    cursor: pointer;
  }
</style>
