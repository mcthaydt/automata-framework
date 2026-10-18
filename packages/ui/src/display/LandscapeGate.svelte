<!--
  @component
  The landscape gate's cover (M4 spec §4.9, §7; FloorFifty `ui/components/LandscapeGate.svelte` at `ac72660`): over
  every screen and every dialog, empty whenever the gate is open (`state` none). Where the browser can hide its bar,
  one tap on the focused button does it; where it cannot, the cover says how to play. The runtime decides the state
  (`landscapeGate`) and only standalone (M4-D5): under Ruken the host frames the game.
-->
<script lang="ts">
import type { LandscapeGateState } from '../browser/landscape-gate'
import { holdModal } from '../dialog/modal-scope'
import type { LandscapeGateCopy } from './display-copy'

interface Props {
  state: LandscapeGateState
  copy: LandscapeGateCopy
  onfullscreen: () => void
}

// `state` is the prop's name; inside it is `gate`, as `$state` is the rune's.
const { state: gate, copy, onfullscreen }: Props = $props()

// `bind:this` sets null when the cover goes, so both are checked for null as well.
let scrim = $state<HTMLElement | null | undefined>(undefined)
let panel = $state<HTMLElement | null | undefined>(undefined)
// It holds the page as a modal does (`modal-scope.ts`): the page behind is inert and focus starts on the one thing
// the cover offers. Escape does nothing: only fullscreen, or turning the phone, opens the gate.
$effect(() => (scrim == null || panel == null ? undefined : holdModal(scrim, panel, () => undefined)))
</script>

{#if gate !== 'none'}
  <div bind:this={scrim} class="af-landscape-gate" data-testid="landscape-gate" data-gate={gate}>
    <div
      bind:this={panel}
      class="af-landscape-gate__panel"
      role="dialog"
      aria-modal="true"
      aria-labelledby="af-landscape-gate-title"
      tabindex="-1"
      data-scroll-region
    >
      {#if gate === 'fullscreen'}
        <h2 id="af-landscape-gate-title" class="af-landscape-gate__title">{copy.title}</h2>
        <p class="af-landscape-gate__body">{copy.body}</p>
        <button
          type="button"
          class="af-control af-control--primary"
          data-kind="primary"
          data-testid="landscape-gate-fullscreen"
          onclick={onfullscreen}>{copy.go}</button
        >
      {:else}
        <h2 id="af-landscape-gate-title" class="af-landscape-gate__title">{copy.uprightTitle}</h2>
        <p class="af-landscape-gate__body">{copy.uprightBody}</p>
      {/if}
    </div>
  </div>
{/if}

<style>
  /* Over everything, dialogs included: nothing under it is playable until the bar is gone. */
  .af-landscape-gate {
    position: fixed;
    inset: 0 0 var(--af-visual-inset-bottom, 0px);
    z-index: 200;
    box-sizing: border-box;
    display: grid;
    place-items: center;
    padding: max(var(--af-gutter), var(--af-inset-top, 0px)) max(var(--af-gutter), var(--af-inset-right, 0px))
      max(var(--af-gutter), var(--af-inset-bottom, 0px)) max(var(--af-gutter), var(--af-inset-left, 0px));
    background: var(--af-scrim);
    touch-action: none;
  }

  .af-landscape-gate__panel {
    box-sizing: border-box;
    display: grid;
    gap: 12px;
    max-width: 26rem;
    max-height: 100%;
    overflow-y: auto;
    padding: 20px;
    border: var(--af-edge-width) solid var(--af-edge);
    border-radius: var(--af-radius);
    background: var(--af-panel);
    color: var(--af-ink);
    text-align: center;
    font: var(--af-text-body) / 1.4 var(--af-font);
  }

  .af-landscape-gate__title {
    margin: 0;
    font-weight: 700;
  }

  .af-landscape-gate__body {
    margin: 0;
  }
</style>
