<!--
  A failure, and what the player can do about it (M1.6 spec §3.4; from FloorFifty
  `ui/components/ErrorPanel.svelte` at 122a220).

  `role="alert"` rather than `role="status"`, because this interrupts: the player usually just
  pressed something and needs to know it did not work. The panel is opaque, because a failure is
  often the thing that means the artwork did not arrive. It sits at the top of the visible region,
  under the corner row, so it never covers the way out of the screen it reports on, and its layer
  passes taps through everywhere but the panel.

  Where the room above a keyboard is short, the panel gives up space in this order: first the gap
  that keeps it under the corner row (it rises over the corner row rather than lose an action),
  then the message, which scrolls. The actions sit outside the scrolling part and never shrink, so
  every way forward stays whole and in view (framework audit of #7).
-->
<script lang="ts">
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
</script>

<div class="af-error-layer">
  <div class="af-error-panel" role="alert" data-code={code} data-testid={testId}>
    <p class="af-error-panel__message" data-scroll-region>{message}</p>
    {#if actions.length > 0}
      <div class="af-error-panel__actions">
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

  /* The room the corner row takes, so the panel sits under it. It shrinks first, and far faster
     than the panel (its shrink weight is 1000 to the panel's 1), when the layer is short. */
  .af-error-layer::before {
    content: "";
    flex: 0 1000 calc(var(--af-target) + var(--af-gutter));
  }

  /* Two rows, the message and the actions. The panel may shrink to fit the layer (min-height 0);
     its rows then share the height it gets. The message row's minimum is 0 (a scroll container
     with min-height 0), the actions row's is the actions themselves, so the message shrinks and
     scrolls and the actions keep their whole height. */
  .af-error-panel {
    box-sizing: border-box;
    width: min(100%, 35rem);
    flex: 0 1 auto;
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
    container-type: inline-size;
  }

  .af-error-panel__message {
    margin: 0;
    min-height: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
  }

  .af-error-panel__actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  /* The message and its actions on one row wherever the panel is wide enough. */
  @container (min-width: 420px) {
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
