<!--
  The profile choice: a file that two or more profiles claim. Each profile is a button
  named by its label; choosing one reads the file again with it, which may open it or show the error panel. Cancel and
  Escape open nothing. The candidates come from the registry, so nothing here names a profile.
-->
<script lang="ts">
import Button from '../../shared/kit/widgets/Button.svelte'
import Dialog from '../../shared/kit/widgets/Dialog.svelte'
import type { ChoiceOutcome } from '../../shared/level-2d/documents/open-flow-model'

interface Props {
  outcome: ChoiceOutcome | undefined
  onchoose: (profileId: string) => void
  oncancel: () => void
}

const { outcome, onchoose, oncancel }: Props = $props()

const name = $derived(outcome === undefined ? '' : outcome.path.slice(outcome.path.lastIndexOf('/') + 1))
let chosen = false
</script>

{#if outcome}
  <Dialog
    open={true}
    title={`Open ${name} as`}
    onclose={() => {
      if (!chosen) oncancel()
      chosen = false
    }}
  >
    <p>More than one kind of file this editor opens claims it. Choose how to open it.</p>
    {#snippet actions({ close })}
      <Button onclick={close}>Cancel</Button>
      {#each outcome.candidates as candidate (candidate.id)}
        <Button
          variant="primary"
          onclick={() => {
            chosen = true
            close()
            onchoose(candidate.id)
          }}
        >
          {candidate.label}
        </Button>
      {/each}
    {/snippet}
  </Dialog>
{/if}

<style>
  p {
    margin: 0;
    color: var(--color-text-dim);
  }
</style>
