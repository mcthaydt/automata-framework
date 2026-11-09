<!-- The Levels 2D status line: the open file, the group's other files, and why a write was refused. -->
<script lang="ts">
import type { Levels2dSession } from './levels-2d-session'

const { session }: { session: Levels2dSession } = $props()

// svelte-ignore state_referenced_locally
const refused = session.refused
// svelte-ignore state_referenced_locally
const shared = session.shared
</script>

<p class="status">
  <span>{session.path}</span>
  {#if session.others.length > 0}<span>{session.others.length} more in this group</span>{/if}
  {#if $shared !== undefined}<span role="status">{$shared}</span>{/if}
  {#if $refused !== undefined}<span role="alert">Not saved: {$refused}</span>{/if}
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
