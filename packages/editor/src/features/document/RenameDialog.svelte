<!--
  Rename, opened by tapping the name in the top bar: one text field holding the name, Rename (the one primary action)
  and Cancel. An empty name, or one only of spaces, cannot be kept: Rename waits until there is a name. The rename is
  one undo step, made by the screen that opened the dialog.
-->
<script lang="ts">
import Button from '../../shared/kit/widgets/Button.svelte'
import Dialog from '../../shared/kit/widgets/Dialog.svelte'

interface Props {
  open: boolean
  /** The name as it is now; the field starts with it. */
  name: string
  onrename: (name: string) => void
}

let { open = $bindable(), name, onrename }: Props = $props()

// svelte-ignore state_referenced_locally
let typed = $state(name)
$effect(() => {
  if (open) typed = name
})
const kept = $derived(typed.trim())

function rename(close: () => void): void {
  if (kept === '') return
  close()
  if (kept !== name) onrename(kept)
}
</script>

<Dialog bind:open title="Rename">
  <form
    onsubmit={(event) => {
      event.preventDefault()
      rename(() => (open = false))
    }}
  >
    <label>
      <span>Name</span>
      <input type="text" bind:value={typed} data-autofocus autocomplete="off" />
    </label>
  </form>
  {#snippet actions({ close })}
    <Button onclick={close}>Cancel</Button>
    <Button variant="primary" disabled={kept === ''} onclick={() => rename(close)}>Rename</Button>
  {/snippet}
</Dialog>

<style>
  label {
    display: grid;
    gap: var(--space-1);
    color: var(--muted);
    font: var(--text-label-12);
  }
  input {
    box-sizing: border-box;
    min-height: var(--size-hit);
    padding: 0 var(--space-3);
    border: 1px solid var(--line-strong);
    border-radius: var(--edge);
    background: var(--surface);
    color: var(--ink);
    font: var(--text-body-13);
  }
  input:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: 1px;
  }
</style>
