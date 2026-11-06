<!--
  Restore or Discard. Asked when a document opens
  with an autosave newer than its file, before it is worked on. It is not dismissible: Escape and the scrim do nothing,
  since both answers change what is open. Restore edits, which has focus, applies the autosave as one undoable step;
  Discard throws it away. When the file also changed since the autosave began, it says that restoring replaces that.
-->
<script lang="ts">
import type { Recovery } from '../storage/recovery'
import Button from '../widgets/Button.svelte'
import Dialog from '../widgets/Dialog.svelte'
import { recoveryFacts } from './recovery-facts'

interface Props {
  path: string
  recovery: Recovery | undefined
  /** The time the autosave's age is told against. */
  now: number
  busy: boolean
  onrestore: () => void
  ondiscard: () => void
}

const { path, recovery, now, busy, onrestore, ondiscard }: Props = $props()

const facts = $derived(recovery === undefined ? [] : recoveryFacts(path, recovery, now))
</script>

{#if recovery}
  <Dialog open={true} title="Restore your unsaved work?" dismissible={false}>
    <div class="body">
      <p>This file has edits that were never saved. The autosave kept them as they were made.</p>
      <dl>
        {#each facts as fact (fact.label)}
          <div class="fact"><dt>{fact.label}</dt><dd>{fact.value}</dd></div>
        {/each}
      </dl>
      {#if recovery.baseChanged}
        <p class="warn" role="alert">The file also changed since the autosave began; restoring replaces that change.</p>
      {/if}
    </div>
    {#snippet actions()}
      <Button disabled={busy} onclick={ondiscard}>Discard</Button>
      <Button variant="primary" data-autofocus disabled={busy} onclick={onrestore}>Restore edits</Button>
    {/snippet}
  </Dialog>
{/if}

<style>
  .body {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }
  p {
    margin: 0;
    color: var(--muted);
  }
  .warn {
    color: var(--warn);
  }
  dl {
    margin: 0;
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--line);
    border-radius: var(--radius-md);
    background: var(--paper);
  }
  .fact {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    gap: var(--space-1) var(--space-3);
    padding: var(--space-1) 0;
  }
  dt {
    color: var(--muted);
  }
  dd {
    margin: 0;
    overflow-wrap: anywhere;
    color: var(--ink);
  }
</style>
