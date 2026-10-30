<!--
  Asks once before a project goes (plan ED2D.4c2a, decision 7). Says what goes with the file and names the destructive
  action. Cancel has focus first, so a stray Enter keeps the file; the kit's dialog returns focus to where it was.
-->
<script lang="ts">
import { Button, Dialog } from '@mcthaydt/automata-editor-kit'

interface Props {
  open: boolean
  /** The file's name. */
  name: string
  onconfirm: () => void
}

let { open = $bindable(), name, onconfirm }: Props = $props()
</script>

<Dialog bind:open title={`Delete ${name}?`}>
  <p>The file and its autosave are removed from this workspace. This can’t be undone.</p>
  {#snippet actions({ close })}
    <Button data-autofocus onclick={close}>Cancel</Button>
    <Button
      variant="danger"
      onclick={() => {
        close()
        onconfirm()
      }}
    >
      Delete
    </Button>
  {/snippet}
</Dialog>

<style>
  p {
    margin: 0;
    color: var(--color-text-dim);
    overflow-wrap: anywhere;
  }
</style>
