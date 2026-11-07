<!--
  @component
  Back at the start, the game's own corner controls (Mute, a language flag) at the end, in the
  same row on every screen (M1.6 spec §3.4; from FloorFifty `ui/layout/CornerControls.svelte` at
  122a220). A screen does not render its own. `header` sits between them in the same row, on the
  screen's centre line, so a short screen spends no row of its own on it.
-->
<script lang="ts">
import type { Snippet } from 'svelte'

interface Props {
  back?: (() => void) | undefined
  /** Back's words, in the game's language. */
  backLabel?: string | undefined
  backTestId?: string | undefined
  header?: Snippet | undefined
  end?: Snippet | undefined
}

const { back, backLabel = 'Back', backTestId = 'corner-back', header, end }: Props = $props()
</script>

<div class="af-corners" data-corner-controls>
  <div class="af-corners__start">
    {#if back !== undefined}
      <button type="button" class="af-control af-control--ghost" data-testid={backTestId} onclick={back}>
        <span aria-hidden="true">←</span>
        {backLabel}
      </button>
    {/if}
  </div>
  <div class="af-corners__middle">{#if header !== undefined}{@render header()}{/if}</div>
  <div class="af-corners__end">{#if end !== undefined}{@render end()}{/if}</div>
</div>

<style>
  /* One row, the target's height and no more. The two corners share what the middle leaves
     equally, so the middle stands on the screen's centre line whether or not there is a Back. */
  .af-corners {
    display: grid;
    grid-template-columns: 1fr minmax(0, max-content) 1fr;
    align-items: center;
    gap: 8px;
    min-height: var(--af-target);
  }

  /* A corner never gives up width its controls need (TV scale enlarges Back past an equal share on
     a narrow phone): the middle gives way instead, clipped with an ellipsis, so nothing in it can
     paint over a corner control. The middle then leaves the centre line, which is the lesser loss. */
  .af-corners__start :global(.af-control) {
    white-space: nowrap;
  }

  .af-corners__middle {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .af-corners__end {
    justify-self: end;
    display: flex;
    gap: 8px;
  }
</style>
