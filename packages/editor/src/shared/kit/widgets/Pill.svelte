<!--
  A small label: a state (ok, warn, bad) or an accent that says what kind of thing this is. The colour is a CSS
  variable, so the stylesheet owns every colour; `accent` names one by its custom property (`--color-layer-tiles`).
-->
<script lang="ts">
import type { Snippet } from 'svelte'

interface Props {
  tone?: 'ok' | 'warn' | 'bad' | 'neutral' | undefined
  /** A colour token, as `--color-layer-tiles`; it replaces `tone`. */
  accent?: string | undefined
  children: Snippet
}

const { tone, accent, children }: Props = $props()
</script>

<span
  class="pill"
  data-pill
  data-tone={accent === undefined ? (tone ?? 'neutral') : undefined}
  style:--pill-color={accent === undefined ? undefined : `var(${accent})`}
>
  {@render children()}
</span>

<style>
  .pill {
    --pill-color: var(--muted);
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    min-height: 22px;
    padding: 0 var(--space-2);
    border: 1px solid color-mix(in srgb, var(--pill-color) 45%, transparent);
    border-radius: var(--edge);
    background: color-mix(in srgb, var(--pill-color) 14%, transparent);
    color: var(--pill-color);
    font: var(--text-label-12);
    white-space: nowrap;
  }
  .pill[data-tone='ok'] {
    --pill-color: var(--ok);
  }
  .pill[data-tone='warn'] {
    --pill-color: var(--warn);
  }
  .pill[data-tone='bad'] {
    --pill-color: var(--bad);
  }
</style>
