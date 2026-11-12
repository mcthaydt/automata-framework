<!--
  What an editor says when the game cannot play what it makes: what the game cannot do, then why and what still works.
  `short` is the status line's, one sentence, so the bar stays one line. No link and nothing about tools: the person
  cannot act on either.
-->
<script lang="ts">
import { noPlayerWords, type PlayerEditor } from '../game-player.ts'

const { editor, short = false }: { editor: PlayerEditor; short?: boolean } = $props()
const [first, second] = $derived(noPlayerWords(editor))
</script>

{#if short}
  <p class="line" role="status">{first}</p>
{:else}
  <div class="note" role="note">
    <p class="first">{first}</p>
    <p>{second}</p>
  </div>
{/if}

<style>
  .note {
    display: grid;
    gap: var(--space-1);
    padding: var(--space-3);
    border: 1px solid var(--color-border-default);
    border-radius: var(--edge-sm);
    background: var(--color-bg-field);
  }
  p {
    margin: 0;
    color: var(--color-text-dim);
    font: var(--text-body-13);
  }
  .first {
    color: var(--color-text-primary);
  }
  .line {
    color: var(--color-text-dim);
  }
</style>
