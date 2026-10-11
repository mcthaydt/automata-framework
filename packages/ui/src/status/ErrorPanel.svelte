<!--
  A failure, and what the player can do about it (M1.6 spec §3.4; from FloorFifty
  `ui/components/ErrorPanel.svelte` at 122a220).

  `role="alert"` rather than `role="status"`, because this interrupts: the player usually just
  pressed something and needs to know it did not work. The panel is opaque, because a failure is
  often the thing that means the artwork did not arrive. It sits at the top of the visible region,
  under the corner row, so it never covers the way out of the screen it reports on, and its layer
  passes taps through everywhere but the panel.

  Where the room is short (a long message, a keyboard), the panel gives up space in this order:
  first the message, which scrolls, down to one visible line; only then the gap that keeps it under
  the corner row, so it rises over Back only when its actions cannot fit any other way. A final
  panel has no actions and is the screen's last word, so it never rises: Back is its way out. The
  actions sit outside the scrolling part and never shrink (framework audit of #7).
-->
<script lang="ts">
import { observeSize, observeWidth } from '../layout/observe-size'
import { assertWayForward, type ErrorAction } from './error-panel'

interface Props {
  /** A stable code for tests and telemetry: the boot failure state, for example. */
  code: string
  message: string
  actions: readonly ErrorAction[]
  /** The failure has no way forward at all (the device cannot run the game). */
  final?: boolean | undefined
  testId?: string | undefined
}

const { code, message, actions, final = false, testId = 'error-panel' }: Props = $props()

// Checked before the first render and again whenever the actions change.
$effect.pre(() => {
  assertWayForward(actions, final)
})

let panel = $state<HTMLElement | undefined>(undefined)
let messageBox = $state<HTMLElement | undefined>(undefined)
let actionsBox = $state<HTMLElement | undefined>(undefined)
/** The panel's least height: its padding and border, one line of message and the actions, in px. */
let floor = $state<number | undefined>(undefined)
let layer = $state<HTMLElement | undefined>(undefined)
let cornerGap = $state<HTMLElement | undefined>(undefined)
/**
 * How the message and its actions share the panel:
 * - `row`: side by side, where the message keeps its readable width (20 characters, or the whole
 *   panel where that is narrower) beside the actions;
 * - `stack`: the actions under the message;
 * - `row-tight`: side by side with the message down to half its readable width.
 * The panel takes the first of those, in that order, that fits under the corner row; only where
 * none does may it rise over the corner row, taking the one with the least floor (stable sort, so
 * that order breaks ties), which covers the least of it. Where
 * nothing fits even then (a TV-sized panel in a strip of a window), the panel stacks and
 * `overflows`: it fills the visible region and scrolls as a whole, so its reason reads and every
 * action is a scroll away. Measured, because the actions' width (their count and labels) is not
 * known to CSS.
 */
type Layout = 'row' | 'stack' | 'row-tight'
let layout = $state<Layout>('stack')
let overflows = $state(false)
/** The least floor of the layouts the panel could take, published for the layout contract. */
let fitFloor = $state<number | undefined>(undefined)

const px = (value: string): number => Number.parseFloat(value) || 0

/** The actions' own width on one line: each button and the gaps between them. */
function actionsWidth(actions: HTMLElement): number {
  const buttons = [...actions.children] as HTMLElement[]
  const gap = px(getComputedStyle(actions).columnGap)
  return buttons.reduce((sum, button) => sum + button.offsetWidth, 0) + gap * Math.max(0, buttons.length - 1)
}

/** The height the layer leaves the panel, its padding taken off. */
function room(layer: HTMLElement): number {
  const style = getComputedStyle(layer)
  return layer.clientHeight - px(style.paddingTop) - px(style.paddingBottom)
}

/** How wide `chars` characters of the message's font are, from a probe laid out in the panel. */
function charsWide(panel: HTMLElement, chars: number): number {
  const probe = document.createElement('span')
  probe.style.cssText = `position:absolute;visibility:hidden;width:${chars}ch`
  panel.append(probe)
  const width = probe.getBoundingClientRect().width
  probe.remove()
  return width
}

/** The panel's least height in the layout it has now: its chrome, one message line and the actions. */
function floorNow(
  panel: HTMLElement,
  style: CSSStyleDeclaration,
  message: HTMLElement,
  actions?: HTMLElement,
): number {
  const chrome =
    px(style.paddingTop) + px(style.paddingBottom) + px(style.borderTopWidth) + px(style.borderBottomWidth)
  const line = px(getComputedStyle(message).lineHeight)
  if (actions === undefined) return Math.ceil(chrome + line)
  const sameRow = actions.offsetTop < message.offsetTop + message.offsetHeight
  const content = sameRow
    ? Math.max(line, actions.offsetHeight)
    : line + px(style.rowGap) + actions.offsetHeight
  return Math.ceil(chrome + content)
}

/**
 * Picks the layout and measures the panel's floor. CSS cannot give the floor: a flex item's
 * automatic minimum is its whole content (the full message), and the message's own
 * `min-height: 1lh` only holds inside the panel. Without the floor the panel would shrink past its
 * actions; with it, the layer shrinks the panel first (down to the floor) and only then the corner
 * gap. To compare layouts it lays the panel out in each, synchronously, and reads it back; the
 * attribute is then left as Svelte last wrote it and `layout` updates it. Skipped where nothing is
 * laid out (jsdom).
 */
function measureFloor(): void {
  const node = panel
  const message = messageBox
  const actions = actionsBox
  const layerNode = layer
  const gap = cornerGap
  if (node === undefined || message === undefined || layerNode === undefined || node.offsetHeight === 0)
    return
  // Measure as the panel normally lies: an overflowing layer drops its padding and corner gap.
  const shortRoom = layerNode.dataset.room
  delete layerNode.dataset.room
  const style = getComputedStyle(node)
  const space = room(layerNode)
  const underCorner = space - (gap === undefined ? 0 : px(getComputedStyle(gap).flexBasis))
  if (actions === undefined) {
    if (shortRoom !== undefined) layerNode.dataset.room = shortRoom
    layout = 'stack'
    overflows = false
    fitFloor = undefined
    floor = floorNow(node, style, message)
    return
  }
  const shown = node.dataset.layout
  const tryLayout = (candidate: Layout) => {
    node.dataset.layout = candidate
    return { layout: candidate, floor: floorNow(node, style, message, actions), width: message.clientWidth }
  }
  const inner = node.clientWidth - px(style.paddingLeft) - px(style.paddingRight)
  const readable = Math.min(charsWide(node, 20), inner)
  const row = tryLayout('row')
  const beside = inner - actionsWidth(actions) - px(style.columnGap) >= readable - 0.5
  const stacked = tryLayout('stack')
  const tight = tryLayout('row-tight')
  if (shown !== undefined) node.dataset.layout = shown
  if (shortRoom !== undefined) layerNode.dataset.room = shortRoom
  // The layouts the panel may take, in the order it prefers them.
  const candidates = [
    ...(beside ? [row] : []),
    stacked,
    ...(tight.width >= readable / 2 - 0.5 ? [tight] : []),
  ]
  fitFloor = Math.min(...candidates.map((candidate) => candidate.floor))
  // Under the corner row: the first that fits. Over it: the least floor, so it covers the least.
  const rising = candidates.filter((candidate) => candidate.floor <= space).sort((a, b) => a.floor - b.floor)
  const chosen = candidates.find((candidate) => candidate.floor <= underCorner) ?? rising[0]
  if (chosen === undefined) {
    layout = 'stack'
    overflows = true
    floor = undefined
    return
  }
  layout = chosen.layout
  overflows = false
  floor = chosen.floor
}

$effect(() => {
  const node = panel
  if (node === undefined) return
  void message
  void actions
  measureFloor()
  const stops = [observeWidth(node, measureFloor)]
  // The keyboard and the host's reservations change the layer's height, not the panel's width.
  if (layer !== undefined) stops.push(observeSize(layer, measureFloor))
  if (actionsBox !== undefined) stops.push(observeWidth(actionsBox, measureFloor))
  return () => {
    for (const stop of stops) stop()
  }
})
</script>

<div
  bind:this={layer}
  class="af-error-layer"
  data-final={final ? '' : undefined}
  data-room={overflows ? 'short' : undefined}
>
  <div bind:this={cornerGap} class="af-error-layer__corner" data-corner-gap aria-hidden="true"></div>
  <div
    bind:this={panel}
    class="af-error-panel"
    role="alert"
    data-code={code}
    data-testid={testId}
    data-layout={layout}
    data-fit-floor={fitFloor}
    data-overflow={overflows ? '' : undefined}
    data-scroll-region={overflows ? '' : undefined}
    style:min-height={floor === undefined ? undefined : `${floor}px`}
  >
    <p bind:this={messageBox} class="af-error-panel__message" data-scroll-region data-testid={`${testId}-message`}>
      {message}
    </p>
    {#if actions.length > 0}
      <div bind:this={actionsBox} class="af-error-panel__actions">
        {#each actions as action (action.id)}
          <button
            type="button"
            class={action.kind === 'primary' ? 'af-control af-control--primary' : 'af-control'}
            data-kind={action.kind}
            data-testid={`error-${action.id}`}
            onclick={action.onSelect}>{action.label}</button
          >
        {/each}
      </div>
    {/if}
  </div>
</div>

<style>
  /* The layer spans the visible region: from the top inset down to whatever the browser lays over
     the page's foot (the keyboard), so the panel never reaches under it. Taps outside the panel
     pass through to the screen. */
  .af-error-layer {
    position: fixed;
    inset: 0 0 var(--af-visual-inset-bottom, 0px);
    z-index: 95;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: max(var(--af-gutter), var(--af-inset-top, 0px)) max(var(--af-gutter), var(--af-inset-right, 0px))
      var(--af-gutter) max(var(--af-gutter), var(--af-inset-left, 0px));
    pointer-events: none;
  }

  /* The room the corner row takes, so the panel sits under it. When the layer is short the panel
     shrinks first, far faster (its shrink weight is 100000 to this gap's 1), until it reaches its
     floor; then this gap gives way, and the panel rises over the corner row. */
  .af-error-layer__corner {
    flex: 0 1 calc(var(--af-target) + var(--af-gutter));
  }

  /* A final panel never covers Back: with no actions, Back is the only way out. */
  .af-error-layer[data-final] .af-error-layer__corner {
    flex-shrink: 0;
  }

  /* Too little room for any layout (`overflows`): the panel takes the whole visible region, from
     the top inset to the keyboard, and scrolls; its scrollport is then as tall as it can be, so
     each action shows whole once scrolled to. */
  .af-error-layer[data-room="short"] {
    padding-top: var(--af-inset-top, 0px);
    padding-bottom: 0;
  }

  .af-error-layer[data-room="short"] .af-error-layer__corner {
    flex-basis: 0;
  }

  .af-error-layer[data-room="short"] .af-error-panel {
    flex: 1 1 0;
  }

  /* Two rows, the message and the actions. The panel shrinks to fit the layer, down to the floor
     measured in script (an inline min-height); its rows then share the height it gets. The message
     row's minimum is one line, the actions row's is the actions themselves, so the message shrinks
     and scrolls and the actions keep their whole height. */
  .af-error-panel {
    box-sizing: border-box;
    width: min(100%, 35rem);
    flex: 0 100000 auto;
    min-height: 0;
    display: grid;
    grid-template-rows: auto auto;
    gap: 12px;
    padding: 12px 16px;
    border: var(--af-edge-width) solid var(--af-on-danger);
    border-radius: var(--af-radius);
    background: var(--af-danger);
    color: var(--af-on-danger);
    font: var(--af-text-body) / 1.4 var(--af-font);
    pointer-events: auto;
  }

  /* At least one line always shows, so the actions never stand without their reason. */
  .af-error-panel__message {
    margin: 0;
    min-height: 1lh;
    /* Its readable width, 20 characters: below that the actions stack under it (`layout`). In
       `row-tight` the grid column overrides it. */
    min-width: min(20ch, 100%);
    overflow-y: auto;
    overscroll-behavior: contain;
  }

  .af-error-panel__actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  /* The message and its actions on one row (decided in script: `layout`). */
  /* Too little room for any layout: the panel scrolls as a whole (`overflows`). */
  .af-error-panel[data-overflow] {
    overflow-y: auto;
    overscroll-behavior: contain;
  }

  .af-error-panel:is([data-layout="row"], [data-layout="row-tight"]) {
    grid-template-columns: minmax(0, 1fr) auto;
    grid-template-rows: auto;
    align-items: center;
  }

  .af-error-panel:is([data-layout="row"], [data-layout="row-tight"]) .af-error-panel__message {
    align-self: stretch;
  }

  .af-error-panel[data-layout="row-tight"] .af-error-panel__message {
    min-width: 0;
  }
</style>
