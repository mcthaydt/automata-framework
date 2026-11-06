<!--
  The save conflict: the document was changed somewhere else since it was opened, so the save wrote nothing. In plain
  words (the grandma audit): Use mine writes the edits over it; Use theirs reloads it and drops the edits (the
  destructive one); Keep both saves the edits as a copy and is the one primary action, with the focus, since it loses
  nothing. Cancel and Escape leave the edits as they are. The three choices are disabled while one runs.
-->
<script lang="ts">
import Button from '../widgets/Button.svelte'
import Dialog from '../widgets/Dialog.svelte'

interface Props {
  open: boolean
  /** The document's name, as its top bar shows it ("Mossgate"). */
  name: string
  busy: boolean
  onkeep: () => void
  ontake: () => void
  oncopy: () => void
  oncancel: () => void
}

const { open, name, busy, onkeep, ontake, oncopy, oncancel }: Props = $props()

let chose = false

function choose(run: () => void, close: () => void): void {
  chose = true
  close()
  run()
}
</script>

{#if open}
  <Dialog
    open={true}
    title={`${name} was changed somewhere else`}
    onclose={() => {
      if (!chose) oncancel()
      chose = false
    }}
  >
    <p>
      It was saved from another place while you worked on it here. Nothing has been overwritten. Keep both saves your
      changes as a copy, Use mine saves over the other version, and Use theirs throws your changes away.
    </p>
    {#snippet actions({ close })}
      <Button onclick={close}>Cancel</Button>
      <Button variant="danger" disabled={busy} onclick={() => choose(ontake, close)}>Use theirs</Button>
      <Button disabled={busy} onclick={() => choose(onkeep, close)}>Use mine</Button>
      <Button variant="primary" data-autofocus disabled={busy} onclick={() => choose(oncopy, close)}>Keep both</Button>
    {/snippet}
  </Dialog>
{/if}

<style>
  p {
    margin: 0;
    color: var(--muted);
  }
</style>
