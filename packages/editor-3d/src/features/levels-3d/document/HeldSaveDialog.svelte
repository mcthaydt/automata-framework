<!--
  The held Save (plan ED3D.5c, decision 6; ED3D spec §8 and §11; ED3-o): the codec cannot write the change while
  keeping the file's layout, so nothing was written. It names the JSON path and the codec's reason, and offers Save
  reformatted (primary, with the focus: it keeps the edits and the file), Export a copy (the file stays as it is), and
  Cancel. The two ways on are disabled while one runs; the dialog closes while it runs and reopens if it refuses again.
-->
<script lang="ts">
import { Button, Dialog } from '@automata/editor/kit'
import { heldSave } from './open-flow-model'
import type { PatchRefused } from './patched-document'

interface Props {
  open: boolean
  path: string
  refused: PatchRefused | undefined
  busy: boolean
  onreformat: () => void
  onexport: () => void
  oncancel: () => void
}

const { open, path, refused, busy, onreformat, onexport, oncancel }: Props = $props()

const words = $derived(refused === undefined ? undefined : heldSave(path, refused))
let chose = false

function choose(run: () => void, close: () => void): void {
  chose = true
  close()
  run()
}
</script>

{#if open && words}
  <Dialog
    open={true}
    title={words.title}
    onclose={() => {
      if (!chose) oncancel()
      chose = false
    }}
  >
    <div class="body">
      <dl>
        <div class="fact"><dt>Where</dt><dd><code>{words.path}</code></dd></div>
        <div class="fact"><dt>Why</dt><dd>{words.reason}</dd></div>
      </dl>
      <p>{words.message}</p>
    </div>
    {#snippet actions({ close })}
      <Button onclick={close}>Cancel</Button>
      <Button disabled={busy} onclick={() => choose(onexport, close)}>Export a copy</Button>
      <Button variant="primary" data-autofocus disabled={busy} onclick={() => choose(onreformat, close)}>
        Save reformatted
      </Button>
    {/snippet}
  </Dialog>
{/if}

<style>
  .body {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }
  p {
    margin: 0;
    color: var(--color-text-dim);
  }
  dl {
    margin: 0;
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--color-border-default);
    border-radius: var(--radius-md);
    background: var(--color-bg-field);
  }
  .fact {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-1) var(--space-3);
    padding: var(--space-1) 0;
  }
  dt {
    min-width: 4rem;
    color: var(--color-text-dim);
  }
  dd {
    flex: 1;
    margin: 0;
    overflow-wrap: anywhere;
  }
  code {
    color: var(--color-state-warn);
    font: var(--text-mono-12);
  }
</style>
