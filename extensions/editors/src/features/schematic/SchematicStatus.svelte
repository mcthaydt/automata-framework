<!-- The behaviour file's problems, counted, in words; and a line that says the game is still playing the last version that worked. -->
<script lang="ts">
import type { SchematicSession } from './schematic-session.svelte.ts'

const { session }: { session: SchematicSession } = $props()
const count = $derived(session.problems.length)
</script>

<p class="status" role="status">
  {#if session.read.kind === 'syntax'}
    This scene's file has a mistake, so it is read only.
  {:else if count > 0}
    {count === 1 ? '1 problem' : `${count} problems`} in this scene.
    Your game is still playing the last version that worked. Fix the problems to see this one.
  {:else if session.read.kind === 'ok'}
    No problems.
  {/if}
  {#if session.fairAge === undefined}
    Fair play: not checked yet.
  {:else if session.fairAge === 0}
    Fair play: checked on this version.
  {:else}
    Fair play: last checked {session.fairAge === 1 ? '1 change' : `${session.fairAge} changes`} ago.
  {/if}
</p>

<style>
  .status {
    margin: 0;
    color: var(--color-text-dim);
    font: var(--text-body-13);
  }
</style>
