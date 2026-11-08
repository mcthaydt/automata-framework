<!--
  Keep my changes or Throw away. Asked when a document opens with an autosave newer than its file, before it is
  worked on, in plain words (`recovery-facts.ts`): the document's name and when it was changed. It is not dismissible:
  Escape and the scrim do nothing, since both answers change what is open. Keep my changes, the one primary action and
  the focus, applies the autosave as one undoable step; Throw away drops it. When the file also changed since the
  autosave began, it says that keeping the changes replaces that.
-->
<script lang="ts">
import type { Recovery } from '../storage/recovery'
import Button from '../widgets/Button.svelte'
import Dialog from '../widgets/Dialog.svelte'
import { recoveryWords } from './recovery-facts'

interface Props {
  /** The document's name, as its top bar shows it ("Mossgate"). */
  name: string
  recovery: Recovery | undefined
  /** The time the autosave's age is told against. */
  now: number
  busy: boolean
  onrestore: () => void
  ondiscard: () => void
}

const { name, recovery, now, busy, onrestore, ondiscard }: Props = $props()

const words = $derived(recovery === undefined ? undefined : recoveryWords(name, recovery, now))
</script>

{#if recovery && words}
  <Dialog open={true} title="Keep your changes from last time?" dismissible={false}>
    <div class="body">
      <p>{words.kept}</p>
      {#if words.warning !== undefined}
        <p class="warn" role="alert">{words.warning}</p>
      {/if}
    </div>
    {#snippet actions()}
      <Button disabled={busy} onclick={ondiscard}>Throw away</Button>
      <Button variant="primary" data-autofocus disabled={busy} onclick={onrestore}>Keep my changes</Button>
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
</style>
