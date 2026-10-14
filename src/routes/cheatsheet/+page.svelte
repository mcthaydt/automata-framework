<script lang="ts">
  import {
    Check,
    Copy,
    Hash,
    Search,
    Terminal,
  } from 'lucide-svelte'
  import { CHEATSHEET_MODULES, searchCheatsheet, type CheatsheetEntry } from '../../data/cheatsheet'

  let searchInput: HTMLInputElement | undefined = $state()
  let searchQuery = $state('')
  let selectedModuleName = $state('all')
  let copiedSignature = $state<string | null>(null)

  let searchResults = $derived.by(() => {
    if (!searchQuery.trim()) return null
    return searchCheatsheet(searchQuery)
  })

  let visibleModules = $derived.by(() => {
    if (selectedModuleName === 'all') return CHEATSHEET_MODULES
    return CHEATSHEET_MODULES.filter((m) => m.name === selectedModuleName)
  })

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === '/' && document.activeElement !== searchInput) {
      e.preventDefault()
      searchInput?.focus()
    }
  }

  async function copySignature(sig: string) {
    try {
      await navigator.clipboard.writeText(sig)
      copiedSignature = sig
      setTimeout(() => {
        if (copiedSignature === sig) copiedSignature = null
      }, 2000)
    } catch (_e) {
      copiedSignature = sig
      setTimeout(() => {
        if (copiedSignature === sig) copiedSignature = null
      }, 2000)
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<svelte:head>
  <title>API Cheatsheet — Automata Framework</title>
</svelte:head>

<div class="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
  <!-- Header Bar -->
  <div class="border-b border-white/10 pb-6">
    <div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <div>
        <h1 class="font-mono text-2xl font-bold tracking-tight text-white sm:text-3xl">
          API Cheatsheet
        </h1>
        <p class="mt-1 text-sm text-zinc-400">
          Fast, exhaustive reference across all 7 framework packages. Press <kbd class="rounded border border-white/10 bg-zinc-800 px-1.5 py-0.5 font-mono text-xs text-zinc-300">/</kbd> to search.
        </p>
      </div>

      <!-- Search Input Box -->
      <div class="relative w-full md:w-80">
        <Search class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
        <input
          bind:this={searchInput}
          bind:value={searchQuery}
          type="text"
          placeholder="Filter functions, types..."
          class="w-full rounded-xl border border-white/10 bg-zinc-900/80 py-2 pl-9 pr-4 font-mono text-xs text-white placeholder-zinc-500 shadow-inner outline-none transition focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30"
        />
      </div>
    </div>

    <!-- Module Selector Tabs -->
    <div class="mt-6 flex flex-wrap items-center gap-1.5">
      <button
        type="button"
        onclick={() => (selectedModuleName = 'all')}
        class={`rounded-lg px-3 py-1 font-mono text-xs transition ${
          selectedModuleName === 'all'
            ? 'bg-cyan-400 font-semibold text-zinc-950'
            : 'border border-white/5 bg-zinc-900/60 text-zinc-400 hover:text-white'
        }`}
      >
        All Modules
      </button>
      {#each CHEATSHEET_MODULES as mod}
        <button
          type="button"
          onclick={() => (selectedModuleName = mod.name)}
          class={`rounded-lg px-3 py-1 font-mono text-xs transition ${
            selectedModuleName === mod.name
              ? 'bg-cyan-400 font-semibold text-zinc-950'
              : 'border border-white/5 bg-zinc-900/60 text-zinc-400 hover:text-white'
          }`}
        >
          {mod.title}
        </button>
      {/each}
    </div>
  </div>

  <!-- Search Results Mode -->
  {#if searchResults !== null}
    <div class="mt-8 space-y-4">
      <div class="font-mono text-xs text-zinc-400">
        Found {searchResults.length} matching signature{searchResults.length === 1 ? '' : 's'} for "{searchQuery}":
      </div>
      {#if searchResults.length === 0}
        <div class="rounded-xl border border-white/10 bg-zinc-900/40 p-8 text-center text-sm text-zinc-500 font-mono">
          No signatures match your search query.
        </div>
      {:else}
        <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
          {#each searchResults as entry}
            <div class="flex flex-col justify-between rounded-xl border border-white/10 bg-zinc-900/60 p-5 shadow-lg backdrop-blur">
              <div class="space-y-3">
                <div class="flex items-center justify-between">
                  <span class="font-mono text-sm font-bold text-white">{entry.name}</span>
                  <button
                    type="button"
                    onclick={() => copySignature(entry.signature)}
                    class="flex items-center gap-1 rounded px-2 py-1 text-xs text-zinc-400 transition hover:bg-white/5 hover:text-white"
                  >
                    {#if copiedSignature === entry.signature}
                      <Check class="h-3 w-3 text-emerald-400" />
                      <span class="text-[10px] text-emerald-400">Copied</span>
                    {:else}
                      <Copy class="h-3 w-3" />
                      <span class="text-[10px]">Copy</span>
                    {/if}
                  </button>
                </div>

                <div class="rounded-lg bg-zinc-950 p-3 font-mono text-xs text-cyan-300 overflow-x-auto">
                  <code>{entry.signature}</code>
                </div>

                <p class="text-xs leading-relaxed text-zinc-400">{entry.description}</p>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  {:else}
    <!-- Categorized Modules Mode -->
    <div class="mt-8 space-y-12">
      {#each visibleModules as mod}
        <div class="space-y-4">
          <div class="flex items-center gap-3 border-b border-white/5 pb-2">
            <Hash class="h-4 w-4 text-cyan-400" />
            <h2 class="font-mono text-lg font-bold text-white">{mod.title}</h2>
            <span class="font-mono text-xs text-zinc-500">({mod.name})</span>
          </div>

          <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
            {#each mod.entries as entry}
              <div class="flex flex-col justify-between rounded-xl border border-white/10 bg-zinc-900/60 p-5 shadow-lg backdrop-blur">
                <div class="space-y-3">
                  <div class="flex items-center justify-between">
                    <span class="font-mono text-sm font-bold text-white">{entry.name}</span>
                    <button
                      type="button"
                      onclick={() => copySignature(entry.signature)}
                      class="flex items-center gap-1 rounded px-2 py-1 text-xs text-zinc-400 transition hover:bg-white/5 hover:text-white"
                    >
                      {#if copiedSignature === entry.signature}
                        <Check class="h-3 w-3 text-emerald-400" />
                        <span class="text-[10px] text-emerald-400">Copied</span>
                      {:else}
                        <Copy class="h-3 w-3" />
                        <span class="text-[10px]">Copy</span>
                      {/if}
                    </button>
                  </div>

                  <div class="rounded-lg bg-zinc-950 p-3 font-mono text-xs text-cyan-300 overflow-x-auto">
                    <code>{entry.signature}</code>
                  </div>

                  <p class="text-xs leading-relaxed text-zinc-400">{entry.description}</p>

                  {#if entry.parameters && entry.parameters.length > 0}
                    <div class="pt-2 border-t border-white/5 text-[11px] font-mono space-y-1">
                      <div class="text-zinc-500 uppercase tracking-wider font-semibold">Parameters:</div>
                      {#each entry.parameters as param}
                        <div class="text-zinc-400">
                          <span class="text-zinc-300 font-medium">{param.name}</span>: <span class="text-zinc-500">{param.type}</span> — {param.desc}
                        </div>
                      {/each}
                    </div>
                  {/if}
                </div>
              </div>
            {/each}
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>
