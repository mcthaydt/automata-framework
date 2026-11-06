<!--
  @component
  The host's save state in words: checking, syncing, saved, offline-queued, retry, conflict, recovered, and
  "no grant" for a game that was not given the saves grant ("Progress won't be kept"). It is not focusable. The line is
  a polite live region that stays mounted while the state changes, so a screen reader hears each change.
  With no `status` (the standalone session, where nothing syncs) it renders nothing at all.
  A state that asks for notice (good news or a problem) shows a glyph beside its words, hidden from assistive
  technology, which has the words, so the tone never rests on colour alone.
-->
<script lang="ts">
import { SAVE_STATUS_TONES, type SaveStatusCopy, type SaveStatusState } from './save-status'

interface Props {
  /** The host's state, or undefined where there is nothing to say (standalone). */
  status: SaveStatusState | undefined
  copy: SaveStatusCopy
  testId?: string | undefined
}

const { status, copy, testId = 'save-status' }: Props = $props()

const GLYPHS = { info: undefined, success: '✓', warning: '!' } as const
const tone = $derived(status === undefined ? undefined : SAVE_STATUS_TONES[status])
const glyph = $derived(tone === undefined ? undefined : GLYPHS[tone])
</script>

{#if status !== undefined}
  <p class="af-save-status" data-save-status data-state={status} data-tone={tone} data-testid={testId} role="status" aria-live="polite">
    {#if glyph !== undefined}<span class="af-save-status__glyph" data-save-status-glyph aria-hidden="true">{glyph}</span>{/if}<span class="af-save-status__text" data-save-status-text>{copy[status]}</span>
  </p>
{/if}

<style>
  /* One line of small text that wraps in a narrow parent; it never sets its own width. */
  .af-save-status {
    display: flex;
    align-items: baseline;
    gap: 4px;
    box-sizing: border-box;
    max-width: 100%;
    margin: 0;
    color: var(--af-ink);
    font: 600 var(--af-text-small) / 1.3 var(--af-font);
    overflow-wrap: anywhere;
  }

  .af-save-status[data-tone="success"] .af-save-status__glyph {
    color: var(--af-success);
  }

  .af-save-status[data-tone="warning"] .af-save-status__glyph {
    color: var(--af-accent);
  }

  .af-save-status__glyph {
    flex: none;
    font-weight: 800;
  }
</style>
