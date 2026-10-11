<!--
  A failure, and what the player can do about it (M1.6 spec §3.4; from FloorFifty
  `ui/components/ErrorPanel.svelte` at 122a220).

  `role="alert"` rather than `role="status"`, because this interrupts: the player usually just
  pressed something and needs to know it did not work. The panel is opaque, because a failure is
  often the thing that means the artwork did not arrive. It sits at the top of the visible region,
  under the corner row, so it never covers the way out of the screen it reports on, and its layer
  passes taps through everywhere but the panel.
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
    <p class="af-error-panel__message">{message}</p>
    {#if actions.length > 0}
      <div class="af-error-panel__actions">
        {#each actions as action (action.id)}
          <button
            type="button"
            class={action.kind === 'primary' ? 'af-control af-control--primary' : 'af-control'}
            data-testid={`error-${action.id}`}
            onclick={action.onSelect}>{action.label}</button
          >
        {/each}
      </div>
    {/if}
  </div>
</div>

<style>
  .af-error-layer {
    position: fixed;
    inset: 0 0 auto;
    z-index: 95;
    box-sizing: border-box;
    display: grid;
    justify-items: center;
    padding: calc(max(var(--af-gutter), var(--af-inset-top, 0px)) + var(--af-target) + var(--af-gutter))
      max(var(--af-gutter), var(--af-inset-right, 0px)) 0 max(var(--af-gutter), var(--af-inset-left, 0px));
    pointer-events: none;
  }

  .af-error-panel {
    box-sizing: border-box;
    width: min(100%, 35rem);
    display: grid;
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
      align-items: center;
    }
  }
</style>
