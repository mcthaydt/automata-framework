<script lang="ts">
// The debug overlay (M6 spec §4.2). Opened by the dev key or a three-finger tap; it renders the host's panels as tabs in a
// declared scroll region, and opening it pauses nothing. One panel throwing shows its error in its tab and the rest keep working.
import { onMount, setContext } from 'svelte'
import { currentHost, HOST_CONTEXT } from './host'
import { createOverlay, type OverlayState } from './overlay'
import PanelFrame from './PanelFrame.svelte'

const host = currentHost()
const overlay = createOverlay({ panels: host?.panels ?? [], setPaused: host?.setPaused })
let view: OverlayState = $state(overlay.state())
if (host !== undefined) setContext(HOST_CONTEXT, host)

onMount(() => {
  const off = overlay.subscribe((next) => {
    view = next
  })
  const onKey = (event: KeyboardEvent): void => {
    if (overlay.key(event.key)) event.preventDefault()
  }
  const onTouch = (event: TouchEvent): void => {
    overlay.touch(event.touches.length)
  }
  window.addEventListener('keydown', onKey)
  window.addEventListener('touchstart', onTouch)
  return () => {
    off()
    window.removeEventListener('keydown', onKey)
    window.removeEventListener('touchstart', onTouch)
  }
})

const shown = $derived(host?.panels.find((p) => p.id === view.tab))
</script>

{#if host !== undefined && view.open}
  <div class="automata-debug-overlay" role="dialog" aria-label="Debug">
    <div class="bar">
      <div role="tablist" aria-label="Debug panels">
        {#each host.panels as panel (panel.id)}
          <button
            type="button"
            role="tab"
            aria-selected={view.tab === panel.id}
            onclick={() => overlay.select(panel.id)}>{panel.title}</button>
        {/each}
      </div>
      <label>
        <input
          type="checkbox"
          checked={view.paused}
          onchange={(event) => overlay.setPaused(event.currentTarget.checked)} />
        Pause sim
      </label>
      <button type="button" onclick={() => overlay.close()}>Close</button>
    </div>
    <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
    <div class="body" role="region" aria-label="Debug panel" tabindex="0">
      {#if shown !== undefined}
        {#key shown.id}
          <svelte:boundary>
            <PanelFrame panel={shown} />
            {#snippet failed(error)}
              <p role="alert">{shown.title}: {error instanceof Error ? error.message : String(error)}</p>
            {/snippet}
          </svelte:boundary>
        {/key}
      {:else}
        <p>No debug panels.</p>
      {/if}
    </div>
  </div>
{/if}

<style>
  .automata-debug-overlay {
    position: absolute;
    inset: 0;
    z-index: 900; /* above the HUD, below dialogs */
    display: flex;
    flex-direction: column;
    background: rgb(0 0 0 / 0.82);
    color: #e8e8e8;
    font: 12px/1.4 ui-monospace, monospace;
  }
  .bar {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
    padding: 4px 8px;
  }
  [role='tablist'] {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    flex: 1;
  }
  button {
    min-height: 44px;
    min-width: 44px;
    color: inherit;
    background: rgb(255 255 255 / 0.12);
    border: 1px solid rgb(255 255 255 / 0.3);
  }
  button[aria-selected='true'] {
    background: rgb(255 255 255 / 0.3);
  }
  label {
    display: flex;
    align-items: center;
    gap: 6px;
    min-height: 44px;
  }
  .body {
    flex: 1;
    min-height: 0;
    overflow: auto;
    padding: 8px;
  }
</style>
