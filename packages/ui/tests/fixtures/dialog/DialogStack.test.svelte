<!--
  Test host for dialog.test.ts only: a dialog that opens a second one over itself, the way
  "Leave the game?" can ask "Discard this run?".
-->
<script lang="ts">
import Dialog from '#src/dialog/Dialog.svelte'

const { onfirstclose, onsecondclose }: { onfirstclose: () => void; onsecondclose: () => void } = $props()

let second = $state(false)
</script>

<button type="button" class="af-control">Behind</button>

<Dialog title="Leave the game?" onclose={onfirstclose}>
  Your progress is saved.
  {#snippet actions()}
    <button type="button" class="af-control" onclick={() => (second = true)}>Discard run</button>
    {#if second}
      <Dialog title="Discard this run?" onclose={onsecondclose}>
        This cannot be undone.
        {#snippet actions()}<button type="button" class="af-control">Discard</button>{/snippet}
      </Dialog>
    {/if}
  {/snippet}
</Dialog>
