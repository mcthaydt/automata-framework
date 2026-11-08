<!-- The feel file's problems, counted, in words; nothing when there are none. -->
<script lang="ts">
import NoPlayer from '../../shared/ui/NoPlayer.svelte'
import type { FeelSession } from './feel-session.svelte.ts'

const { session }: { session: FeelSession } = $props()
const count = $derived(session.read.kind === 'invalid' ? session.read.problems.length : 0)
</script>

{#if !session.hasPlayer}<NoPlayer editor="feel" short />{/if}
<p class="status" role="status">
  {#if session.read.kind === 'syntax'}
    The feel file has a mistake, so it is read only.
  {:else if count === 1}
    1 problem in the feel file.
  {:else if count > 1}
    {count} problems in the feel file.
  {:else if session.read.kind === 'ok'}
    No problems.
  {/if}
</p>

<style>
  .status {
    margin: 0;
    color: var(--color-text-dim);
    font: var(--text-body-13);
  }
</style>
