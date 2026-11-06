<!--
  Asks once before a level goes. Names the level as people know it (its title, never its file) and says it cannot
  come back. Cancel has focus first, so a stray Enter keeps the level; the kit's dialog returns focus to where it was.
-->
<script lang="ts">
import Button from '../../shared/kit/widgets/Button.svelte'
import Dialog from '../../shared/kit/widgets/Dialog.svelte'

interface Props {
  open: boolean
  /** The level's name, as its card shows it. */
  name: string
  onconfirm: () => void
}

let { open = $bindable(), name, onconfirm }: Props = $props()
</script>

<Dialog bind:open title={`Delete ${name}?`}>
  <p>This level is deleted for good. You can’t undo this.</p>
  {#snippet actions({ close })}
    <Button data-autofocus onclick={close}>Cancel</Button>
    <Button
      variant="danger"
      onclick={() => {
        close()
        onconfirm()
      }}
    >
      Delete level
    </Button>
  {/snippet}
</Dialog>

<style>
  p {
    margin: 0;
    color: var(--muted);
    overflow-wrap: anywhere;
  }
</style>
