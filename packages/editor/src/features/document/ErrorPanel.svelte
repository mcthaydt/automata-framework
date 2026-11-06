<!--
  The error panel: a file that does not open, over
  Home. It names the file and what is wrong with it, in the profile's own words with the line, column or key path each
  error gives, shows the text read only with those lines marked, and says that nothing was written. Copy text puts the
  text on the clipboard; Open another, which has focus, goes back to the list. It knows no profile and reads no code.
-->
<script lang="ts">
import type { WriteResult } from '../../shared/kit/storage/project-store'
import Button from '../../shared/kit/widgets/Button.svelte'
import Dialog from '../../shared/kit/widgets/Dialog.svelte'
import type { ToastStore } from '../../shared/kit/widgets/toasts'
import { errorPanel, type PanelOutcome } from '../../shared/level-2d/documents/open-flow-model'
import TextView from './TextView.svelte'

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

async function copy(text: string): Promise<void> {
  const result = await copyText(text)
  toasts.push(
    result.ok
      ? { kind: 'ok', message: `Copied the text of ${name}.` }
      : { kind: 'error', message: `Could not copy the text: ${result.message}` },
  )
}
</script>

{#if panel}
  <Dialog open={true} title={panel.title} width="wide" onclose={() => onclose()}>
    <div class="body">
      <ul class="problems">
        {#each panel.problems as problem, index (index)}
          <li>
            <span class="text">{problem.text}</span>
            {#if problem.where !== undefined}<span class="where">{problem.where}</span>{/if}
          </li>
        {/each}
      </ul>
      {#if panel.text !== undefined}
        <TextView text={panel.text} marked={panel.lines} />
      {/if}
      <div class="callout">
        <strong>Nothing was written</strong>
        <span>The file is unchanged. You can read it here, copy its text, or open it with the editor that made it.</span>
      </div>
    </div>
    {#snippet actions({ close })}
      {#if panel.text !== undefined}
        {@const text = panel.text}
        <Button onclick={() => copy(text)}>Copy text</Button>
      {/if}
      <Button variant="primary" data-autofocus onclick={close}>Open another</Button>
    {/snippet}
  </Dialog>
{/if}

<style>
  .body {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }
  .problems {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    margin: 0;
    padding: 0;
    list-style: none;
  }
  li {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: var(--space-1) var(--space-2);
    overflow-wrap: anywhere;
  }
  .text {
    color: var(--color-text-primary);
  }
  .where {
    color: var(--color-state-warn);
    font: var(--text-mono-12);
  }
  .callout {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    padding: var(--space-3);
    border: 1px solid var(--color-border-default);
    border-radius: var(--edge);
    background: var(--color-bg-surface);
    color: var(--color-text-dim);
  }
  .callout strong {
    color: var(--color-text-primary);
    font: var(--text-body-13-medium);
  }
</style>
