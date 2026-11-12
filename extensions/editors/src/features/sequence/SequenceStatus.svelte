<!-- What is wrong in the open cutscene, counted in words. -->
<script lang="ts">
import { Button } from '@automata/editor/kit'
import NoPlayer from '../../shared/ui/NoPlayer.svelte'
import ProblemCount from '../../shared/ui/ProblemCount.svelte'
import type { SequenceSession } from './sequence-session.svelte.ts'

const { session }: { session: SequenceSession } = $props()
const read = $derived(session.current?.read)
const found = $derived(session.problems)
const first = $derived(found[0])
</script>

{#if !session.hasPlayer}<NoPlayer editor="sequence" short />{/if}
{#if read !== undefined}
  {#if read.kind === 'syntax' || read.kind === 'invalid'}
    <ProblemCount {read} noun="cutscene" />
  {:else if first !== undefined}
    <p class="status" role="status">
      {found.length === 1 ? '1 problem' : `${String(found.length)} problems`} in the cutscene{found.length === 1 ? '' : '. The first'}: {first.words}
      <Button variant="quiet" onclick={() => session.select({ track: first.track, index: first.index })}>Show me</Button>
    </p>
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
