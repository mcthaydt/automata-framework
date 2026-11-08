<!-- The Levels 2D status line: the open file, the group's other files, and why a write was refused. -->
<script lang="ts">
import { onDestroy } from 'svelte'
import type { Levels2dSession } from './levels-2d-session'

const { session }: { session: Levels2dSession } = $props()

// A refused write takes its step back, so the history's change is when the refusal is new.
// svelte-ignore state_referenced_locally
let refusal = $state(session.refusal)
// svelte-ignore state_referenced_locally
const stop =
  session.state.kind === 'open'
    ? session.state.history.subscribe(() => (refusal = session.refusal))
    : undefined
onDestroy(() => stop?.())
</script>

<p class="status">
  <span>{session.path}</span>
  {#if session.others.length > 0}<span>{session.others.length} more in this group</span>{/if}
  {#if refusal !== undefined}<span role="alert">Not saved: {refusal}</span>{/if}
</p>

<style>
  .status {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-3);
    margin: 0;
    font: var(--text-body-13);
    color: var(--color-text-dim);
  }
</style>
