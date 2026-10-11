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
/**
 * How the message and its actions share the panel:
 * - `row`: side by side, where the message keeps its readable width (its `min-width`, 20
 *   characters) beside the actions;
 * - `stack`: the actions under the message, everywhere else;
 * - `row-tight`: side by side although the message is narrower (down to half its readable width),
 *   only where the room left to the panel is shorter than the stacked panel and the row fits it.
 *   There the choice is a narrow message or actions under the keyboard, and a narrow message reads.
 * Where neither fits (a TV-sized panel in a strip of a window), the panel stacks and `overflows`:
 * it becomes a scroll region of its own, so its reason reads and every action is a scroll away.
 * Measured, because the actions' width (their count and labels) is not known to CSS.
 */
type Layout = 'row' | 'stack' | 'row-tight'
let layout = $state<Layout>('stack')
let overflows = $state(false)
let stackFloor = $state<number | undefined>(undefined)

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
  if (node === undefined || message === undefined || layer === undefined || node.offsetHeight === 0) return
  const style = getComputedStyle(node)
  const space = room(layer)
  if (actions === undefined) {
    layout = 'stack'
    stackFloor = undefined
    floor = floorNow(node, style, message)
    overflows = false
    return
  }
  const shown = node.dataset.layout
  const tryLayout = (candidate: Layout) => {
    node.dataset.layout = candidate
    return { floor: floorNow(node, style, message, actions), width: message.clientWidth }
  }
  const stacked = tryLayout('stack')
  const readable = px(getComputedStyle(message).minWidth)
  const row = tryLayout('row')
  // The message's room beside the actions on one line: the panel's inner width less theirs.
  const inner = node.clientWidth - px(style.paddingLeft) - px(style.paddingRight)
  const beside = inner - actionsWidth(actions) - px(style.columnGap) >= readable
  const tight = tryLayout('row-tight')
  if (shown !== undefined) node.dataset.layout = shown
  stackFloor = stacked.floor
  overflows = false
  if (beside) {
    layout = 'row'
    floor = row.floor
  } else if (stacked.floor <= space) {
    layout = 'stack'
    floor = stacked.floor
  } else if (tight.floor <= space && tight.width >= readable / 2 - 0.5) {
    layout = 'row-tight'
    floor = tight.floor
  } else {
    layout = 'stack'
    overflows = true
    floor = Math.floor(space)
  }
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

<div bind:this={layer} class="af-error-layer" data-final={final ? '' : undefined}>
  <div
    bind:this={panel}
    class="af-error-panel"
    role="alert"
    data-code={code}
    data-testid={testId}
    data-layout={layout}
    data-stack-floor={stackFloor}
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
  .af-error-layer::before {
    content: "";
    flex: 0 1 calc(var(--af-target) + var(--af-gutter));
  }

  /* A final panel never covers Back: with no actions, Back is the only way out. */
  .af-error-layer[data-final]::before {
    flex-shrink: 0;
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
    min-width: 20ch;
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
