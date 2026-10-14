<script lang="ts">
  import { Check, Copy } from 'lucide-svelte'
  import { highlightCode } from '../utils/highlight'

  interface Props {
    code: string
    lang?: string
    filename?: string
    copyable?: boolean
    class?: string
  }

  let {
    code,
    lang = 'typescript',
    filename = '',
    copyable = true,
    class: className = '',
  }: Props = $props()

  let html = $state('')
  let copied = $state(false)

  $effect(() => {
    let active = true
    highlightCode(code, lang).then((res) => {
      if (active) html = res
    })
    return () => {
      active = false
    }
  })

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(code)
      copied = true
      setTimeout(() => {
        copied = false
      }, 2000)
    } catch (_e) {
      copied = true
      setTimeout(() => {
        copied = false
      }, 2000)
    }
  }
</script>

<div class={`overflow-hidden rounded-xl border border-white/10 bg-zinc-950 font-mono text-sm shadow-xl ${className}`}>
  <!-- Header bar if filename or copyable -->
  {#if filename || copyable}
    <div class="flex items-center justify-between border-b border-white/5 bg-zinc-900/60 px-4 py-2 text-xs text-zinc-400">
      <div class="flex items-center gap-2">
        <span class="inline-block h-2 w-2 rounded-full bg-zinc-600"></span>
        {#if filename}
          <span class="font-medium text-zinc-300">{filename}</span>
        {:else}
          <span class="uppercase tracking-wider text-zinc-500">{lang}</span>
        {/if}
      </div>
      {#if copyable}
        <button
          type="button"
          onclick={handleCopy}
          class="flex items-center gap-1.5 rounded px-2 py-1 text-zinc-400 transition hover:bg-white/5 hover:text-white"
          aria-label="Copy code"
        >
          {#if copied}
            <Check class="h-3.5 w-3.5 text-emerald-400" />
            <span class="text-[11px] text-emerald-400">Copied</span>
          {:else}
            <Copy class="h-3.5 w-3.5" />
            <span class="text-[11px]">Copy</span>
          {/if}
        </button>
      {/if}
    </div>
  {/if}

  <!-- Shiki Output -->
  <div class="overflow-x-auto p-4 text-[13px] leading-relaxed [&>pre]:!bg-transparent [&>pre]:!m-0 [&>pre]:!p-0">
    {#if html}
      {@html html}
    {:else}
      <pre class="text-zinc-400"><code>{code}</code></pre>
    {/if}
  </div>
</div>
