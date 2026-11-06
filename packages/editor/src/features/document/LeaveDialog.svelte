<!--
  Asked when Back would leave a level with changes not yet saved: "Save your changes to Mossgate?". Save writes the
  level and then leaves (a save that fails or conflicts stays, so its own message is seen); Don't save leaves and throws
  the changes away; Cancel, Escape or a tap outside stay on the level. Save is the one primary action and has the
  focus first, since keeping work is what she most likely wants.
-->
<script lang="ts">
import Button from '../../shared/kit/widgets/Button.svelte'
import Dialog from '../../shared/kit/widgets/Dialog.svelte'

interface Props {
  open: boolean
  /** The level's name, as the top bar shows it. */
  name: string
  onsave: () => void
  ondiscard: () => void
}

let { open = $bindable(), name, onsave, ondiscard }: Props = $props()
</script>

<Dialog bind:open title={`Save your changes to ${name}?`}>
  <p>If you don’t save, your changes since the last save are lost.</p>
  {#snippet actions({ close })}
    <Button onclick={close}>Cancel</Button>
    <Button
      onclick={() => {
        close()
        ondiscard()
      }}
    >
      Don’t save
    </Button>
    <Button
      variant="primary"
      data-autofocus
      onclick={() => {
        close()
        onsave()
      }}
    >
      Save
    </Button>
  {/snippet}
</Dialog>

<style>
  p {
    margin: 0;
    color: var(--muted);
  }
</style>
