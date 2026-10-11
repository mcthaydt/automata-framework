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
import { observeWidth } from '../layout/observe-size'
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

const px = (value: string): number => Number.parseFloat(value) || 0

/**
 * Measures the panel's floor. CSS cannot give it: a flex item's automatic minimum is its whole
 * content (the full message), and the message's own `min-height: 1lh` only holds inside the panel.
 * Without the floor the panel would shrink past its actions; with it, the layer shrinks the panel
 * first (down to the floor) and only then the corner gap. Skipped where nothing is laid out (jsdom).
 */
function measureFloor(): void {
  if (panel === undefined || messageBox === undefined || panel.offsetHeight === 0) return
  const style = getComputedStyle(panel)
  const chrome =
    px(style.paddingTop) + px(style.paddingBottom) + px(style.borderTopWidth) + px(style.borderBottomWidth)
  const line = px(getComputedStyle(messageBox).lineHeight)
  const actionsHeight = actionsBox?.offsetHeight ?? 0
  const sameRow =
    actionsBox !== undefined && actionsBox.offsetTop < messageBox.offsetTop + messageBox.offsetHeight
  const content =
    actionsBox === undefined
      ? line
      : sameRow
        ? Math.max(line, actionsHeight)
        : line + px(style.rowGap) + actionsHeight
  floor = Math.ceil(chrome + content)
}

$effect(() => {
  const node = panel
  if (node === undefined) return
  void message
  void actions
  measureFloor()
  const stops = [observeWidth(node, measureFloor)]
  if (actionsBox !== undefined) stops.push(observeWidth(actionsBox, measureFloor))
  return () => {
    for (const stop of stops) stop()
  }
})
</script>

<div class="af-error-layer" data-final={final ? '' : undefined}>
  <div
    bind:this={panel}
    class="af-error-panel"
    role="alert"
    data-code={code}
    data-testid={testId}
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
    /* The panel's width is the layer's content width, capped: the one-row query below reads it
       here, because a container query styles a container's descendants, never the container. */
    container: af-error-layer / inline-size;
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
    overflow-y: auto;
    overscroll-behavior: contain;
  }

  .af-error-panel__actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  /* The message and its actions on one row wherever the panel is wide enough. */
  @container af-error-layer (min-width: 420px) {
    .af-error-panel {
      grid-template-columns: minmax(0, 1fr) auto;
      grid-template-rows: auto;
      align-items: center;
    }

    .af-error-panel__message {
      align-self: stretch;
    }
  }
</style>
