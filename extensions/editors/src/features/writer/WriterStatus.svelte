<!-- What is wrong in the chosen scene's files and conversations, counted in words. -->
<script lang="ts">
import NoPlayer from '../../shared/ui/NoPlayer.svelte'
import ProblemCount from '../../shared/ui/ProblemCount.svelte'
import { structureProblems } from './writer-problems.ts'
import type { WriterSession } from './writer-session.svelte.ts'

const { session }: { session: WriterSession } = $props()
const lines = $derived(session.files?.lines.read)
const dialogue = $derived(session.files?.dialogue.read)
const conversations = $derived(
  session.graphs.reduce(
    (total, graph) => total + structureProblems(graph, session.files?.lines.content ?? { lines: [] }).length,
    0,
  ),
)
</script>

{#if !session.hasPlayer}<NoPlayer editor="writer" short />{/if}
{#if lines !== undefined && dialogue !== undefined}
  {#if lines.kind === 'syntax' || lines.kind === 'invalid'}
    <ProblemCount read={lines} noun="lines file" />
  {:else if dialogue.kind === 'syntax' || dialogue.kind === 'invalid'}
    <ProblemCount read={dialogue} noun="conversations file" />
  {:else if conversations > 0}
    <p class="status" role="status">
      {conversations === 1 ? '1 problem' : `${String(conversations)} problems`} in the conversations.
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
