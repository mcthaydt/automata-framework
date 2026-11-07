<script lang="ts">
// The feel board: a button for every event `feel.toml` reacts to; pressing one fires it.
import { getContext } from 'svelte'
import { type DebugHost, HOST_CONTEXT } from '../host'

const board = getContext<DebugHost | undefined>(HOST_CONTEXT)?.feel
</script>

{#if board === undefined}
  <p>No feel board installed.</p>
{:else}
  <div class="entries">
    {#each board.entries() as on (on)}
      <button type="button" onclick={() => board.fire(on)}>{on}</button>
    {/each}
  </div>
{/if}

<style>
  .entries {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }
  button {
    min-height: 44px;
    min-width: 44px;
    color: inherit;
    background: rgb(255 255 255 / 0.12);
    border: 1px solid rgb(255 255 255 / 0.3);
  }
</style>
