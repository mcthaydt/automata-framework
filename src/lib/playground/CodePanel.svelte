<script lang="ts" module>
  /** `static` until the first tap or focus on the code, `loading` while the editor chunk downloads (spec F2, §7.3). */
  export type CodeState = 'static' | 'loading' | 'ready' | 'failed'
</script>
<script lang="ts">
  import { onMount, tick } from 'svelte'
  import CopyButton from '$lib/components/CopyButton.svelte'
  import { offsetAtPoint } from './caret'
  import type { HighlightedLine } from './highlight'
  let { source, highlighted, title, describedBy, oncodestate }: {
    source: string
    highlighted: HighlightedLine[]
    title: string
    describedBy: string
    oncodestate?: (state: CodeState) => void
  } = $props()
  // One span per line, each carrying its newline, so the code's text is the source byte for byte; the line numbers are
  // CSS counters and never part of it. The editor takes this box's size and font (spec §9.3), and the pieces carry the
  // editor's own `tok-*` classes.
  let codeState = $state<CodeState>('static')
  let pre: HTMLElement | undefined = $state()
  let host: HTMLElement | undefined = $state()
  let editor: { destroy(): void; focus(): void } | undefined
  let destroyed = false

  function setState(next: CodeState) {
    codeState = next
    oncodestate?.(next)
  }

  async function upgrade(anchor: number) {
    if (codeState !== 'static') return
    setState('loading')
    try {
      const { mountEditor } = await import('./editor')
      if (destroyed) return
      // The swap keeps the page where the reader left it: for a moment both the static code and the editor are in the
      // layout, and Safari on macOS scrolled the page by more than a screen (CI, WebKit) as the static code went.
      const { scrollX, scrollY } = window
      editor = mountEditor({ parent: host!, doc: source, label: 'Code for ' + title + '. Changes update the preview.', describedBy, anchor })
      setState('ready')
      await tick()
      // The static code had focus (a tap or Tab put it there); it moves to the editor, which now holds the same text.
      editor.focus()
      if (window.scrollX !== scrollX || window.scrollY !== scrollY) window.scrollTo(scrollX, scrollY)
    } catch {
      if (!destroyed) setState('failed')
    }
  }

  // The tap's offset is read from the static text before the swap, so the caret lands where the reader tapped.
  const onpointerdown = (event: PointerEvent) => void upgrade(offsetAtPoint(pre!, event.clientX, event.clientY) ?? 0)
  const onfocusin = () => void upgrade(0)

  onMount(() => {
    // A reader who reached the code before the page hydrated has already had their focusin.
    if (document.activeElement === pre) void upgrade(0)
    return () => {
      destroyed = true
      editor?.destroy()
    }
  })
</script>
<section class="code-panel" aria-label={'Code for ' + title}>
  <div class="code-header"><span>TypeScript</span><CopyButton text={source} /></div>
  <!-- Keyboard focus lets readers scroll the code with the arrow keys, and starts the editor. -->
  <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
  <pre class="static-code" data-testid="static-code" tabindex="0" aria-describedby={describedBy} hidden={codeState === 'ready'} {onpointerdown} {onfocusin} bind:this={pre}><code>{#each highlighted as line}<span class="line">{#each line as piece}{#if piece.className}<span class={piece.className}>{piece.text}</span>{:else}{piece.text}{/if}{/each}</span>{/each}</code></pre>
  <div class="editor-host" bind:this={host}></div>
</section>
<style>
  /* No scroll anchoring inside: the static code an anchor would follow goes away in the swap. */
  .code-panel { min-width: 0; border: 1px solid var(--line-strong); border-radius: var(--radius); background: var(--paper); overflow: hidden; overflow-anchor: none; }
  .code-header { display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: 0 .5rem 0 1rem; border-bottom: 1px solid var(--line); font-size: var(--step-small); color: var(--muted); }
  .code-header :global(button) { min-height: 44px; min-width: 44px; }
  .static-code { margin: 0; padding: 1rem 1rem 1rem calc(3ch + 2rem); font-size: 1rem; line-height: 1.5; white-space: break-spaces; overflow-wrap: anywhere; word-break: break-word; overflow: visible; counter-reset: line; }
  /* The editor's own wrapping rules (`EditorView.lineWrapping`), which the site's `pre code` would otherwise reset. */
  .static-code code { white-space: inherit; overflow-wrap: inherit; word-break: inherit; }
  .static-code[hidden] { display: none; }
  .line { counter-increment: line; }
  .line::before { content: counter(line); display: inline-block; width: 3ch; margin-left: calc(-3ch - 1rem); margin-right: 1rem; text-align: right; color: var(--muted); user-select: none; }
  /* The site's focus ring, on the static code and on the editor (§9.2). `:focus-within`, not `.cm-focused`: CodeMirror
     sets that class a moment after focus arrives, and the ring should not lag the caret. */
  .static-code:focus-visible, .editor-host :global(.cm-editor:focus-within) { outline: 2px solid var(--focus); outline-offset: -2px; }
  /* `classHighlighter`'s classes, shared by the static code and the editor. Colour only: weight and style would change
     the glyphs' widths and so the wrapping. */
  .code-panel :global(:is(.tok-keyword, .tok-operatorKeyword)) { color: var(--cobalt); }
  .code-panel :global(:is(.tok-string, .tok-string2, .tok-number, .tok-bool, .tok-atom, .tok-literal)) { color: var(--teal); }
  .code-panel :global(:is(.tok-comment, .tok-meta)) { color: var(--muted); }
  .code-panel :global(:is(.tok-typeName, .tok-className, .tok-namespace)) { color: var(--cobalt-deep); }
</style>
