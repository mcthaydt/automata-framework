<script lang="ts">
  import CopyButton from './CopyButton.svelte'
  import { highlightCode } from '../utils/highlight'
  let { code, lang = 'typescript', filename = '', copyable = true, class: className = '' }: {
    code: string; lang?: string; filename?: string; copyable?: boolean; class?: string
  } = $props()
  let html = $state('')
  let figure: HTMLElement | undefined = $state()
  let near = $state(false)
  // Highlighting a file costs seconds of main-thread time on a phone, so a block waits until it is within a
  // screenful of the viewport (a block inside a closed <details> never is). Until then, and without
  // IntersectionObserver, the plain code shows, as it always did while the highlighter loaded.
  $effect(() => {
    if (near || !figure) return
    if (typeof IntersectionObserver === 'undefined') { near = true; return }
    const observer = new IntersectionObserver(entries => { if (entries.some(entry => entry.isIntersecting)) near = true }, { rootMargin: '300px' })
    observer.observe(figure)
    return () => observer.disconnect()
  })
  $effect(() => {
    if (!near) return
    let active = true
    html = ''
    highlightCode(code, lang).then(result => { if (active) html = result })
    return () => { active = false }
  })
</script>
<figure bind:this={figure} class={`code-block ${className}`}>
  <figcaption><span>{#if filename}<code>{filename}</code>{:else}{lang}{/if}</span>{#if copyable}<CopyButton text={code} />{/if}</figcaption>
  <!-- Keyboard focus lets users scroll long code with arrow keys. -->
  <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
  <div class="code-scroll" tabindex="0" role="region" aria-label={filename || 'Code example'}>
    {#if html}{@html html}{:else}<pre><code>{code}</code></pre>{/if}
  </div>
</figure>
