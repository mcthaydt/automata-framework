<script lang="ts">
  import { Check, Copy } from 'lucide-svelte'

  interface Props {
    command?: string
  }

  let { command = 'npx automata create-game my-game' }: Props = $props()
  let copied = $state(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(command)
      copied = true
      setTimeout(() => {
        copied = false
      }, 2000)
    } catch (_e) {
      // Fallback
      copied = true
      setTimeout(() => {
        copied = false
      }, 2000)
    }
  }
</script>

<div class="inline-flex items-center gap-3 rounded-lg border border-white/10 bg-zinc-900/80 px-4 py-2.5 font-mono text-sm text-zinc-200 shadow-xl backdrop-blur transition-colors hover:border-white/20">
  <span class="select-none text-zinc-500 font-bold">$</span>
  <span class="select-all tracking-tight text-zinc-100">{command}</span>
  <button
    type="button"
    aria-label="Copy command"
    onclick={handleCopy}
    class="ml-2 inline-flex h-7 w-7 items-center justify-center rounded border border-white/5 bg-zinc-800/80 text-zinc-400 transition hover:bg-zinc-700 hover:text-white"
  >
    {#if copied}
      <Check class="h-3.5 w-3.5 text-emerald-400" />
    {:else}
      <Copy class="h-3.5 w-3.5" />
    {/if}
  </button>
</div>
