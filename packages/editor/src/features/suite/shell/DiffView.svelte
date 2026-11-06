<!--
  A file's line diff (the Review desk and the import plan): each hunk's lines marked same, removed or added. It
  scrolls sideways with 16 px under it for the Mac's overlay scroll bar (#265, #272).
-->
<script lang="ts">
import type { Hunk } from '../core/text-diff'

const { hunks }: { hunks: readonly Hunk[] } = $props()

const sign = { same: ' ', removed: '-', added: '+' } as const
const lineText = (text: string): string => text.replace(/\r?\n$/, '')
</script>

<pre class="diff" data-selectable data-scroll-region="horizontal">{#each hunks as hunk, h (h)}{#each hunk.lines as line, l (l)}<span data-kind={line.kind}>{`${sign[line.kind]} ${lineText(line.text)}`}</span>{/each}{/each}</pre>

<style>
  .diff {
    display: grid;
    margin: var(--space-1) 0 0;
    padding: var(--space-2) var(--space-2) 16px;
    overflow-x: auto;
    border: 1px solid var(--color-border-default);
    border-radius: var(--edge-sm);
    font: var(--text-mono-12);
  }
  [data-kind='removed'] {
    background: color-mix(in srgb, var(--color-state-bad) 18%, transparent);
  }
  [data-kind='added'] {
    background: color-mix(in srgb, var(--color-state-ok) 18%, transparent);
  }
</style>
