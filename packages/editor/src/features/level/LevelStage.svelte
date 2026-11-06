<!--
  The Level view's canvas region, canvas first (spec 11.4): the Pixi level canvas fills the region edge to edge, with
  the kit's gesture recogniser on it feeding the session through the gesture map, and the keyboard shortcuts. Over it
  float the tool pill (`LevelToolbar`) and, in a corner, Fit (the whole level in view) and, below `wide`, Details (the
  inspector): the pill at the foot with the corner at the top right on a phone, the pill at the top with the corner at
  the bottom right from an iPad up (the design thread's revised mockup). Both float as siblings of the canvas's box, not inside it, so a press on them
  never reaches the gestures. A locked or hidden layer says so in the left corner across from Fit instead of ignoring the pen
  without a word. The toggles for the panel and the inspector are the host shell's, so they come in as props.
-->
<script lang="ts">
import type { Component } from 'svelte'
import { attachGestures } from '../../shared/kit/gestures/attach-gestures'
import type { History } from '../../shared/kit/history/history'
import IconButton from '../../shared/kit/widgets/IconButton.svelte'
import type { IdSource } from '../../shared/level-2d/model/ids'
import type { LevelCanvasProps } from '../document/view-props'
import LevelCanvas from './LevelCanvas.svelte'
import LevelToolbar from './LevelToolbar.svelte'
import { levelActions } from './level-actions'
import { levelGestures } from './level-gestures'
import type { LevelSession } from './level-session'
import { shortcutFor } from './level-shortcuts'
import { levelState } from './level-state.svelte'

interface Props {
  session: LevelSession
  history: History<unknown>
  read: (path: string) => Promise<Uint8Array | undefined>
  ids: IdSource
  /** The level canvas; the Pixi `LevelCanvas` when absent (jsdom tests pass a stand-in). */
  canvas?: Component<LevelCanvasProps> | undefined
  /** The host's Undo and Redo; without them the keys and the two-finger taps are left to the host. */
  onundo?: (() => void) | undefined
  onredo?: (() => void) | undefined
  showLayers?: boolean
  layersOpen?: boolean
  onlayers?: () => void
  showInspector?: boolean
  inspectorOpen?: boolean
  oninspector?: () => void
  /** Where the tool pill floats; with it at the top, Fit, Details and the layer message move to the foot. */
  toolsAt?: 'top' | 'bottom'
}

const {
  session,
  history,
  read,
  ids,
  canvas,
  onundo,
  onredo,
  showLayers = false,
  layersOpen = false,
  onlayers = () => {},
  showInspector = false,
  inspectorOpen = false,
  oninspector = () => {},
  toolsAt = 'bottom',
}: Props = $props()

// svelte-ignore state_referenced_locally
const level = levelState(session, history)
// svelte-ignore state_referenced_locally
const actions = levelActions(session, level.edits, ids, { onundo, onredo })
// svelte-ignore state_referenced_locally
const Canvas: Component<LevelCanvasProps> = canvas ?? LevelCanvas
let host = $state<HTMLElement>()

const layerDef = $derived(level.project.defs.layers.find((layer) => layer.id === level.view.layer))
/** Why the tools do nothing on this layer right now, in words for the canvas. */
const blocked = $derived.by(() => {
  const view = level.view
  if (layerDef === undefined || view.tool === 'select') return undefined
  if (view.hidden.has(view.layer)) return `${layerDef.label} is hidden. Show it to draw.`
  if (view.locked.has(view.layer)) return `${layerDef.label} is locked. Unlock it to draw.`
  return undefined
})

const isText = (target: EventTarget | null): boolean =>
  target instanceof HTMLElement &&
  (target.isContentEditable ||
    target.tagName === 'TEXTAREA' ||
    (target.tagName === 'INPUT' && (target as HTMLInputElement).type !== 'color'))

function onKey(event: KeyboardEvent): void {
  if (event.defaultPrevented) return
  const focused = event.target instanceof Node ? event.target : null
  const shortcut = shortcutFor(event, {
    inText: isText(event.target),
    canNudge: host !== undefined && focused !== null && host.contains(focused),
  })
  if (shortcut === undefined || !actions.handles(shortcut)) return
  event.preventDefault()
  actions.run(shortcut)
}

// The gestures and the measure go on the canvas's box once it is in the page.
$effect(() => {
  const element = host
  if (element === undefined) return
  const stopGestures = attachGestures(
    element,
    levelGestures(session, { onundo: () => onundo?.(), onredo: () => onredo?.() }),
  )
  const leave = (): void => session.editor.pointerLeave()
  element.addEventListener('pointerleave', leave)
  const Observer = element.ownerDocument.defaultView?.ResizeObserver
  const observer =
    Observer === undefined
      ? undefined
      : new Observer((entries) => {
          const box = entries[0]?.contentRect
          if (box !== undefined && box.width > 0 && box.height > 0)
            session.measure({ w: Math.round(box.width), h: Math.round(box.height) })
        })
  observer?.observe(element)
  return () => {
    stopGestures()
    element.removeEventListener('pointerleave', leave)
    observer?.disconnect()
  }
})
</script>

<div class="stage" data-tools={toolsAt}>
  <!-- svelte-ignore a11y_no_noninteractive_tabindex: the canvas takes focus so arrows nudge the selection -->
  <div
    class="surface"
    bind:this={host}
    data-testid="level-surface"
    role="application"
    aria-label="Level canvas"
    tabindex="0"
  >
    <Canvas project={level.project} view={level.view} {read} camera={level.camera} />
  </div>
  {#if blocked !== undefined}
    <p class="blocked" role="status">{blocked}</p>
  {/if}
  <div class="corner">
    <IconButton icon="fit" label="Fit the level in view" onclick={() => session.fit()} />
    {#if showInspector}
      <IconButton icon="inspector" label="Details" aria-expanded={inspectorOpen} onclick={oninspector} />
    {/if}
  </div>
  <LevelToolbar
    tool={level.view.tool}
    brushSize={level.view.brushSize}
    {showLayers}
    {layersOpen}
    ontool={(tool) => session.editor.setTool(tool)}
    onbrushsize={(size) => session.editor.setBrushSize(size)}
    {onlayers}
    at={toolsAt}
  />
</div>

<svelte:document onkeydown={onKey} />

<style>
  .stage {
    position: relative;
    width: 100%;
    height: 100%;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
  }
  .surface {
    position: absolute;
    inset: 0;
    overflow: hidden;
    overscroll-behavior: contain;
  }
  .corner {
    position: absolute;
    top: var(--space-3);
    right: var(--space-3);
    display: flex;
    gap: var(--space-1);
    padding: var(--space-1);
    border: 1px solid var(--color-border-default);
    border-radius: var(--edge-md);
    background: var(--color-bg-surface);
  }
  /* With the pill at the top, the corner controls and the message take the foot instead. */
  .stage[data-tools='top'] .corner {
    top: auto;
    bottom: var(--space-3);
  }
  .stage[data-tools='top'] .blocked {
    top: auto;
    bottom: var(--space-3);
  }
  /* Top left, leaving the corner controls their room (two 44 px buttons and the margins). */
  .blocked {
    position: absolute;
    top: var(--space-3);
    left: var(--space-3);
    max-width: calc(100% - 2 * var(--space-3) - 2 * var(--size-hit) - 3 * var(--space-2));
    margin: 0;
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--color-border-strong);
    border-radius: var(--edge-sm);
    background: var(--color-bg-raised);
    color: var(--color-text-primary);
    font: var(--text-body-13);
    pointer-events: none;
  }
</style>
