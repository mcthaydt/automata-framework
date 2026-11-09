<!--
  New level (ED3D.13b; ED3D spec §4.6, ED3-q): the dialog Home's New level button opens. A name, Create (disabled until there is one) and Cancel. Enter creates. It only asks; the controller makes the file and opens it.
-->
<script lang="ts">
import { Button, Dialog } from '@automataframework/automata-editor/kit'

interface Props {
  oncreate: (name: string) => void
  onclose: () => void
}

const { oncreate, onclose }: Props = $props()

let name = $state('')
const ready = $derived(name.trim() !== '')

function create(close: () => void): void {
  if (!ready) return
  oncreate(name.trim())
  close()
}
</script>

<Dialog open={true} title="New level" {onclose}>
  <label class="field">
    <span>Level name</span>
    <input
      type="text"
      aria-label="Level name"
      data-autofocus
      bind:value={name}
      onkeydown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault()
          if (ready) {
            oncreate(name.trim())
            onclose()
          }
        }
      }}
    />
  </label>
  {#snippet actions({ close })}
    <Button onclick={close}>Cancel</Button>
    <Button
      variant="primary"
      disabled={!ready}
      onclick={() => create(close)}
    >
      Create
    </Button>
  {/snippet}
</Dialog>

<style>
  .field {
    display: grid;
    gap: var(--space-2);
  }
  input {
    min-height: 44px;
    padding: 0 var(--space-3);
    font: inherit;
  }
</style>
