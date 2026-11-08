<!--
  The error panel (plan ED3D.5c, decision 5; ED3D spec §11): a file that does not open, over Home. It names the file
  and lists each problem with the JSON path where it is (`sectors.0.floor`), says which profile read the file and which
  ones this editor has, and that nothing was written. Copy details puts all of it on the clipboard as text; Open
  another, which has the focus, goes back to the list. The words are `errorPanel`'s; this file only draws them.
-->
<script lang="ts">
import { Button, Dialog } from '@automata/editor/kit'
import type { ToastStore, WriteResult } from '@automata/editor/kit/core'
import { errorPanel, type PanelOutcome } from './open-flow-model'

interface Props {
  outcome: PanelOutcome | undefined
  /** The workspace's clipboard export (`Workspace.exports.copyText`). */
  copyText: (text: string) => Promise<WriteResult>
  toasts: ToastStore
  onclose: () => void
}

const { outcome, copyText, toasts, onclose }: Props = $props()

const panel = $derived(outcome === undefined ? undefined : errorPanel(outcome))
const name = $derived(outcome === undefined ? '' : outcome.path.slice(outcome.path.lastIndexOf('/') + 1))

// One copy at a time: a double press copies once and says so once.
let copying = $state(false)

async function copy(details: string): Promise<void> {
  if (copying) return
  copying = true
  const result = await copyText(details).finally(() => {
    copying = false
  })
  toasts.push(
    result.ok
      ? { kind: 'ok', message: `Copied the details of ${name}.` }
      : { kind: 'error', message: `Could not copy the details: ${result.message}` },
  )
}
</script>

{#if panel}
  <Dialog open={true} title={panel.title} width="wide" onclose={() => onclose()}>
    <div class="body">
      {#if panel.rows.length > 0}
        <ul class="problems" aria-label="Problems">
          {#each panel.rows as row, index (index)}
            <li><code class="path">{row.path}</code> <span class="message">{row.message}</span></li>
          {/each}
        </ul>
      {/if}
      {#if panel.note !== undefined}<p class="note">{panel.note}</p>{/if}
      <div class="callout">
        <strong>Nothing was written</strong>
        <span>The file is unchanged. Copy the details to report it, or open it with the tool that made it.</span>
      </div>
    </div>
    {#snippet actions({ close })}
      {@const details = panel.details}
      <Button disabled={copying} onclick={() => copy(details)}>Copy details</Button>
      <Button variant="primary" data-autofocus onclick={close}>Open another</Button>
    {/snippet}
  </Dialog>
{/if}

<style>
  .body {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    min-width: 0;
  }
  /* A file can have hundreds of problems: the dialog's body is the one scroll region, so the list is plain and the
     panel scrolls inside the dialog, never the page. */
  .problems {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    margin: 0;
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--color-border-default);
    border-radius: var(--radius-md);
    background: var(--color-bg-field);
    list-style: none;
  }
  li {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: var(--space-1) var(--space-2);
    overflow-wrap: anywhere;
  }
  .path {
    color: var(--color-state-warn);
    font: var(--text-mono-12);
  }
  .message {
    color: var(--color-text-primary);
  }
  .note {
    margin: 0;
    color: var(--color-text-dim);
  }
  .callout {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    padding: var(--space-3);
    border: 1px solid var(--color-border-default);
    border-radius: var(--radius-md);
    background: var(--color-bg-surface);
    color: var(--color-text-dim);
  }
  .callout strong {
    color: var(--color-text-primary);
    font: var(--text-body-13-medium);
  }
</style>
