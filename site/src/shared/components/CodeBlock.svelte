<script lang="ts">
// The site's one code box. `block` is highlighted code that scrolls sideways inside the box; `command` is one shell
// line behind a `$`, cut with an ellipsis where it cannot fit, whose copy button still copies all of it. `label` is
// words above the box that say where the code goes ("In your terminal"), never the language.
import { highlightCode } from '../utils/highlight'
import CopyButton from './CopyButton.svelte'

let {
  code,
  lang = 'typescript',
  variant = 'block',
  label = '',
  copyable = true,
  class: className = '',
}: {
  code: string
  lang?: string
  variant?: 'block' | 'command'
  label?: string
  copyable?: boolean
  class?: string
} = $props()
let html = $state('')
let figure: HTMLElement | undefined = $state()
let near = $state(false)
// Highlighting a file costs seconds of main-thread time on a phone, so a block waits until it is within a
// screenful of the viewport (a block inside a closed <details> never is). Until then, and without
// IntersectionObserver, the plain code shows, as it always did while the highlighter loaded.
$effect(() => {
  if (variant === 'command' || near || !figure) return
  if (typeof IntersectionObserver === 'undefined') {
    near = true
    return
  }
  const observer = new IntersectionObserver(
    (entries) => {
      if (entries.some((entry) => entry.isIntersecting)) near = true
    },
    { rootMargin: '300px' },
  )
  observer.observe(figure)
  return () => observer.disconnect()
})
$effect(() => {
  if (variant === 'command' || !near) return
  let active = true
  html = ''
  highlightCode(code, lang).then((result) => {
    if (active) html = result
  })
  return () => {
    active = false
  }
})
</script>
{#if variant === 'command'}
  <div class={`code-block command ${className}`}>
    <span class="prompt" aria-hidden="true">$</span><code class="ellipsis" title={code}>{code}</code>{#if copyable}<CopyButton text={code} label="Copy command" />{/if}
  </div>
{:else}
  <figure bind:this={figure} class={`code-block ${className}`}>
    {#if label}<figcaption>{label}</figcaption>{/if}
    <div class="box">
      <!-- Keyboard focus lets users scroll long code with arrow keys. -->
      <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
      <div class="code-scroll" tabindex="0" role="region" aria-label={label || 'Code example'}>
        {#if html}{@html html}{:else}<!-- svelte-ignore a11y_no_noninteractive_tabindex --><pre tabindex="0"><code>{code}</code></pre>{/if}
      </div>
      {#if copyable}<div class="copy"><CopyButton text={code} /></div>{/if}
    </div>
  </figure>
{/if}

<style>
  .code-block {
    min-width: 0;
    color: var(--ink);
  }
  figcaption {
    margin: 0 0 8px;
    color: var(--muted);
    font-size: var(--step-small);
  }
  .box {
    position: relative;
    overflow: hidden;
    border: 1px solid var(--line);
    border-radius: var(--edge-md);
    background: var(--panel);
  }
  /* The copy button sits in the box's corner; the code keeps clear of it. */
  .copy {
    position: absolute;
    top: 4px;
    right: 4px;
  }
  .code-scroll {
    overflow-x: auto;
    padding: 16px 56px 16px 20px;
  }
  .code-scroll :global(pre) {
    background: transparent !important;
  }
  /* github-dark's comment grey is 3.9:1 on the panel; the muted text colour of the site is 5:1. */
  .code-scroll :global(span[style*='6A737D' i]) {
    color: var(--faint) !important;
  }
  /* A command and its copy button, as Home draws it: a quiet box on a hairline, the command in mono on one line. */
  .command {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 48px;
    padding: 2px 2px 2px 14px;
    border: 1px solid var(--line-strong);
    border-radius: var(--edge-sm);
    background: var(--panel);
    font: 400 13.5px / 20px var(--font-mono);
  }
  .prompt {
    color: var(--faint);
  }
  .ellipsis {
    flex: 1;
    min-width: 0;
    padding: 8px 0;
    background: none;
    font-size: inherit;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  @media (max-width: 760px) {
    .code-scroll {
      padding: 12px 52px 12px 14px;
    }
  }
</style>
