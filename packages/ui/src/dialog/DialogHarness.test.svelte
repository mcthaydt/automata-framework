<!--
  Test host for dialog.test.ts only (from Ruken `packages/ui/src/Dialog.harness.svelte` at b30d31b):
  a trigger that opens a dialog with two actions, the way a game opens "Leave the game?".
-->
<script lang="ts">
import Dialog from './Dialog.svelte'

interface Props {
  /** Marks "Stay" for initial focus, the safe action. */
  markInitialFocus?: boolean
  onclose?: () => void
  onexit?: () => void
}

const { markInitialFocus = true, onclose, onexit }: Props = $props()

let open = $state(false)

function close(): void {
  open = false
  onclose?.()
}
</script>

<button type="button" class="af-control" onclick={() => (open = true)}>Leave</button>
<button type="button" class="af-control">Elsewhere on the page</button>

{#if open}
  <Dialog title="Leave the game?" onclose={close}>
    Your progress is saved.
    {#snippet actions()}
      <button type="button" class="af-control" data-initial-focus={markInitialFocus ? '' : undefined} onclick={close}>Stay</button>
      <button
        type="button"
        class="af-control af-control--primary"
        onclick={() => {
          open = false
          onexit?.()
        }}>Leave game</button
      >
    {/snippet}
  </Dialog>
{/if}
