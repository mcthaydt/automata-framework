<script lang="ts">
  import CopyButton from '$lib/components/CopyButton.svelte'
  let { source, title, describedBy }: { source: string; title: string; describedBy: string } = $props()
  // One span per line, each carrying its newline, so the code's text is the source byte for byte; the line numbers are
  // CSS counters and never part of it. The editor (WEB.PLAY.6) takes this box's size and font (spec §9.3).
  let lines = $derived(source.split('\n').map((line, index, all) => (index < all.length - 1 ? line + '\n' : line)))
</script>
<section class="code-panel" aria-label={'Code for ' + title}>
  <div class="code-header"><span>TypeScript</span><CopyButton text={source} /></div>
  <!-- Keyboard focus lets readers scroll the code with the arrow keys. -->
  <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
  <pre class="static-code" data-testid="static-code" tabindex="0" aria-describedby={describedBy}><code>{#each lines as line}<span class="line">{line}</span>{/each}</code></pre>
</section>
<style>
  .code-panel { min-width: 0; border: 1px solid var(--line-strong); border-radius: var(--radius); background: var(--paper); overflow: hidden; }
  .code-header { display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: 0 .5rem 0 1rem; border-bottom: 1px solid var(--line); font-size: var(--step-small); color: var(--muted); }
  .code-header :global(button) { min-height: 44px; min-width: 44px; }
  .static-code { margin: 0; padding: 1rem 1rem 1rem calc(3ch + 2rem); font-size: 1rem; line-height: 1.5; white-space: pre-wrap; overflow-wrap: anywhere; counter-reset: line; }
  .line { counter-increment: line; }
  .line::before { content: counter(line); display: inline-block; width: 3ch; margin-left: calc(-3ch - 1rem); margin-right: 1rem; text-align: right; color: var(--muted); user-select: none; }
</style>
