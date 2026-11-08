<!-- What is wrong in the open cutscene, counted in words. -->
<script lang="ts">
import ProblemCount from '../../shared/ui/ProblemCount.svelte'
import type { SequenceSession } from './sequence-session.svelte.ts'

const { session }: { session: SequenceSession } = $props()
const read = $derived(session.current?.read)
const problems = $derived(session.problems.length)
</script>

{#if read !== undefined}
  {#if read.kind === 'syntax' || read.kind === 'invalid'}
    <ProblemCount {read} noun="cutscene" />
  {:else if problems > 0}
    <p class="status" role="status">{problems === 1 ? '1 problem' : `${String(problems)} problems`} in the cutscene.</p>
  {:else}
    <p class="status" role="status">No problems.</p>
  {/if}
{/if}

<style>
  .status {
    margin: 0;
    color: var(--color-text-dim);
    font: var(--text-body-13);
  }
</style>
