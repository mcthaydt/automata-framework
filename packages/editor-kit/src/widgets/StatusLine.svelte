<!--
  The foot of the editor (kit spec §4.6): the last thing that happened, whatever the editor wants beside it (a cursor
  position, a zoom), and where the project stands on saving. The message is a polite live region, so keep it for
  what just happened, not for a readout that changes with the pointer; put that in `children`, which is not
  announced. The save pill is announced only when it goes wrong or the project cannot be saved here.
-->
<script lang="ts">
import type { Snippet } from 'svelte'

type SaveState = 'saved' | 'dirty' | 'saving' | 'error' | 'device'

interface Props {
  message?: string | undefined
  save: SaveState
  children?: Snippet | undefined
}

const { message, save, children }: Props = $props()

const LABELS: Readonly<Record<SaveState, string>> = {
  saved: 'Saved',
  dirty: 'Unsaved changes',
  saving: 'Saving…',
  error: 'Save failed',
  device: 'Not saved on this device',
}
</script>

<div class="status" data-widget="status-line">
  <span class="message" role="status">{message ?? ''}</span>
  {#if children}<span class="extras">{@render children()}</span>{/if}
  <span class="save" data-save={save} aria-live={save === 'error' || save === 'device' ? 'polite' : 'off'}>
    {LABELS[save]}
  </span>
</div>

<style>
  .status {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    min-height: 28px;
    padding: 0 var(--space-3);
    border-top: 1px solid var(--color-border-default);
    background: var(--color-bg-surface);
    color: var(--color-text-dim);
    font: var(--text-mono-11);
  }
  .message {
    flex: 1 1 auto;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .extras {
    flex: 0 0 auto;
  }
  .save {
    flex: 0 0 auto;
    padding: 2px var(--space-2);
    border-radius: var(--radius-sm);
    background: var(--color-bg-field);
    color: var(--color-text-dim);
  }
  .save[data-save='saved'] {
    color: var(--color-state-ok);
  }
  .save[data-save='dirty'] {
    color: var(--color-state-warn);
  }
  .save[data-save='error'] {
    color: var(--color-state-bad);
  }
  .save[data-save='device'] {
    color: var(--color-state-warn);
  }
</style>
