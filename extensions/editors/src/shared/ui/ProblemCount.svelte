<!-- A file's problems, counted, in words ("2 problems in the audio file."); "No problems." when it reads cleanly. -->
<script lang="ts">
import type { TomlRead } from '../toml-session.ts'

const { read, noun }: { read: TomlRead<unknown>; noun: string } = $props()
const count = $derived(read.kind === 'invalid' ? read.problems.length : 0)
</script>

<p class="status" role="status">
  {#if read.kind === 'syntax'}
    The {noun} has a mistake, so it is read only.
  {:else if count === 1}
    1 problem in the {noun}.
  {:else if count > 1}
    {count} problems in the {noun}.
  {:else if read.kind === 'ok'}
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
