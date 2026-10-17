<!--
  A short status label (M4 spec §4.12). Its tone is `data-tone` and an edge colour, and never only
  that: every tone but `info` also shows a glyph a sighted player reads and says `toneLabel` to
  assistive technology, so the tone survives with every colour removed. A warning or danger chip
  without words throws while it mounts.
-->
<script lang="ts">
type Tone = 'info' | 'success' | 'warning' | 'danger'

interface Props {
  text: string
  tone?: Tone | undefined
  /** The tone in words, in the game's language ("Error"). Required for every tone but `info`. */
  toneLabel?: string | undefined
  testId?: string | undefined
}

const { text, tone = 'info', toneLabel, testId }: Props = $props()

const GLYPHS: Record<Tone, string | undefined> = { info: undefined, success: '✓', warning: '!', danger: '✕' }

// Checked once, at mount, by design: the first test that mounts a toned chip without words fails.
// svelte-ignore state_referenced_locally
if (tone !== 'info' && (toneLabel ?? '').trim() === '')
  throw new Error(`Chip needs a toneLabel for its ${tone} tone`)

const glyph = $derived(GLYPHS[tone])
</script>

<span class="af-chip" data-chip data-tone={tone} data-testid={testId}>
  {#if glyph !== undefined}
    <span class="af-chip__glyph" data-chip-glyph aria-hidden="true">{glyph}</span>
    <span class="af-sr-only">{toneLabel}</span>
  {/if}
  {text}
</span>

<style>
  .af-chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 8px;
    border: var(--af-edge-width) solid var(--af-edge);
    border-radius: 999px;
    background: var(--af-panel);
    color: var(--af-ink);
    font: 600 var(--af-text-small) / 1.3 var(--af-font);
    white-space: nowrap;
  }

  .af-chip[data-tone="success"] {
    border-color: var(--af-success);
  }

  .af-chip[data-tone="warning"] {
    border-color: var(--af-accent);
  }

  .af-chip[data-tone="danger"] {
    border-color: var(--af-danger-edge);
  }

  .af-chip__glyph {
    font-weight: 800;
  }
</style>
