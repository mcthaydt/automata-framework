<!--
  The save conflict (plan ED2D.4c2b, decision 7; kit spec §5 flow 3; G-m, EK-e): the file changed since it was opened,
  so the save wrote nothing. Keep mine writes the edits over it; Take theirs reloads the file and drops the edits (the
  destructive one); Save as copy keeps both and has focus, since it loses nothing. Cancel and Escape leave the edits
  as they are. The three choices are disabled while one runs.
-->
<script lang="ts">
import { Dialog } from '@mcthaydt/automata-editor-kit'
import Button from '../controls/Button.svelte'

interface Props {
  open: boolean
  path: string
  busy: boolean
  onkeep: () => void
  ontake: () => void
  oncopy: () => void
  oncancel: () => void
}

const { open, path, busy, onkeep, ontake, oncopy, oncancel }: Props = $props()

const name = $derived(path.slice(path.lastIndexOf('/') + 1))
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
    title={`${name} changed since you opened it`}
    onclose={() => {
      if (!chose) oncancel()
      chose = false
    }}
  >
    <p>
      Something else wrote the file after it was opened here. Nothing was overwritten. Keep mine writes your edits over
      it, Take theirs reloads the file and drops your edits, and Save as copy keeps both.
    </p>
    {#snippet actions({ close })}
      <Button onclick={close}>Cancel</Button>
      <Button variant="danger" disabled={busy} onclick={() => choose(ontake, close)}>Take theirs</Button>
      <Button disabled={busy} onclick={() => choose(onkeep, close)}>Keep mine</Button>
      <Button variant="primary" data-autofocus disabled={busy} onclick={() => choose(oncopy, close)}>Save as copy</Button>
    {/snippet}
  </Dialog>
{/if}

<style>
  p {
    margin: 0;
    color: var(--color-text-dim);
  }
</style>
