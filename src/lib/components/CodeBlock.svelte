<script lang="ts">
  import CopyButton from './CopyButton.svelte'
  import { highlightCode } from '../utils/highlight'
  let { code, lang = 'typescript', filename = '', copyable = true, class: className = '' }: {
    code: string; lang?: string; filename?: string; copyable?: boolean; class?: string
  } = $props()
  let html = $state('')
  $effect(() => {
    let active = true
    html = ''
    highlightCode(code, lang).then(result => { if (active) html = result })
    return () => { active = false }
  })
</script>
<figure class={`code-block ${className}`}>
  <figcaption><span>{filename || lang}</span>{#if copyable}<CopyButton text={code} />{/if}</figcaption>
  <!-- Keyboard focus lets users scroll long code with arrow keys. -->
  <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
  <div class="code-scroll" tabindex="0" role="region" aria-label={filename || 'Code example'}>
    {#if html}{@html html}{:else}<pre><code>{code}</code></pre>{/if}
  </div>
</figure>
