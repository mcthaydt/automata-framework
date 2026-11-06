<!--
  The first write's title: a change set opens from it, and its branch is named from it,
  so Start waits for a letter or a digit. Cancel writes nothing.
-->
<script lang="ts">
import Button from '../../../shared/kit/widgets/Button.svelte'
import Dialog from '../../../shared/kit/widgets/Dialog.svelte'

interface Props {
  open: boolean
  onsubmit: (title: string) => void
  oncancel: () => void
}

const { open, onsubmit, oncancel }: Props = $props()

const uid = $props.id()
let title = $state('')
const usable = $derived(/[a-z0-9]/i.test(title))

function start(): void {
  if (usable) onsubmit(title.trim())
}

// One text field: Enter submits the form even with the Start button outside it.
function submit(event: SubmitEvent): void {
  event.preventDefault()
  start()
}
</script>

<Dialog open={open} title="Name this change" onclose={() => oncancel()}>
  <form class="form" onsubmit={submit}>
    <label for={`${uid}-title`}>Title</label>
    <input id={`${uid}-title`} type="text" bind:value={title} autocomplete="off" />
    <p class="hint">Edits go on a branch named from it until you ship.</p>
  </form>
  {#snippet actions()}
    <Button onclick={() => oncancel()}>Cancel</Button>
    <Button variant="primary" disabled={!usable} onclick={start}>Start</Button>
  {/snippet}
</Dialog>

<style>
  .form {
    display: grid;
    gap: var(--space-2);
  }
  input {
    min-height: 44px;
    padding: 0 var(--space-3);
    border: 1px solid var(--color-border-strong);
    border-radius: var(--edge-sm);
    background: var(--color-bg-field);
    color: var(--color-text-primary);
    font: var(--text-body-13);
  }
  .hint {
    margin: 0;
    color: var(--color-text-dim);
  }
</style>
