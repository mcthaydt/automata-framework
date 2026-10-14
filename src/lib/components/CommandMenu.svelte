<script lang="ts">
  import { ArrowRight, BookOpen, Code, Gamepad2, Layers, Search, Sparkles, Terminal, X } from 'lucide-svelte'
  import { getDemosCatalog } from '../../data/demos'

  interface Props {
    isOpen?: boolean
    onClose?: () => void
  }

  let { isOpen = false, onClose = () => {} }: Props = $props()
  let query = $state('')
  let inputEl: HTMLInputElement | undefined = $state()

  const demos = getDemosCatalog()

  const staticLinks = [
    { title: 'Overview', desc: 'Framework philosophy & core architecture', url: '/', icon: Layers },
    { title: 'Examples Gallery', desc: 'Interactive split-view raylib demos', url: '/examples', icon: Code },
    { title: 'API Cheatsheet', desc: 'Searchable API signatures across 7 packages', url: '/cheatsheet', icon: Terminal },
    { title: 'Showcase', desc: 'Games and templates built with Automata', url: '/showcase', icon: Gamepad2 },
    { title: 'Spartan Docs', desc: 'Architecture laws & developer guides', url: '/docs', icon: BookOpen },
    { title: 'AI & Agent Skills', desc: 'Agent install commands, 5 Golden Rules, llms.txt', url: '/ai', icon: Sparkles },
  ]

  let filteredLinks = $derived.by(() => {
    const q = query.trim().toLowerCase()
    if (!q) return staticLinks
    return staticLinks.filter(
      (l) => l.title.toLowerCase().includes(q) || l.desc.toLowerCase().includes(q)
    )
  })

  let filteredDemos = $derived.by(() => {
    const q = query.trim().toLowerCase()
    if (!q) return demos.slice(0, 4)
    return demos.filter(
      (d) =>
        d.title.toLowerCase().includes(q) ||
        d.shows.toLowerCase().includes(q) ||
        d.packages.some((p) => p.toLowerCase().includes(q))
    )
  })

  $effect(() => {
    if (isOpen) {
      setTimeout(() => inputEl?.focus(), 50)
    }
  })

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape' && isOpen) {
      onClose()
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

{#if isOpen}
  <!-- Backdrop -->
  <div
    class="fixed inset-0 z-50 flex items-start justify-center bg-black/70 p-4 pt-20 backdrop-blur-sm sm:p-6 sm:pt-28"
    onclick={onClose}
    onkeydown={(e) => e.key === 'Escape' && onClose()}
    role="dialog"
    tabindex="-1"
    aria-modal="true"
    aria-label="Command search palette"
  >
    <!-- Modal Container -->
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <div
      class="w-full max-w-xl overflow-hidden rounded-2xl border border-white/10 bg-zinc-900 shadow-2xl shadow-black/80 ring-1 ring-white/5"
      onclick={(e) => e.stopPropagation()}
      role="document"
    >
      <!-- Search Bar -->
      <div class="flex items-center gap-3 border-b border-white/10 px-4 py-3">
        <Search class="h-4 w-4 text-zinc-400" />
        <input
          bind:this={inputEl}
          bind:value={query}
          type="text"
          placeholder="Type a command, package, or search..."
          class="flex-1 bg-transparent text-sm text-white placeholder-zinc-500 outline-none"
        />
        <button
          type="button"
          onclick={onClose}
          aria-label="Close search"
          class="rounded p-1 text-zinc-400 transition hover:bg-white/5 hover:text-white"
        >
          <X class="h-4 w-4" />
        </button>
      </div>

      <!-- Results list -->
      <div class="max-h-96 overflow-y-auto p-2 space-y-4">
        <!-- Navigation Section -->
        <div>
          <div class="px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
            Navigation
          </div>
          <div class="mt-1 space-y-0.5">
            {#each filteredLinks as link}
              <a
                href={link.url}
                onclick={onClose}
                class="flex items-center justify-between rounded-lg px-3 py-2 text-sm text-zinc-300 transition hover:bg-white/5 hover:text-white"
              >
                <div class="flex items-center gap-3">
                  <link.icon class="h-4 w-4 text-cyan-400" />
                  <div>
                    <div class="font-medium">{link.title}</div>
                    <div class="text-xs text-zinc-500">{link.desc}</div>
                  </div>
                </div>
                <ArrowRight class="h-3.5 w-3.5 text-zinc-600" />
              </a>
            {/each}
          </div>
        </div>

        <!-- Examples Section -->
        <div>
          <div class="px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
            Examples & Demos
          </div>
          <div class="mt-1 space-y-0.5">
            {#each filteredDemos as demo}
              <a
                href={`/examples?demo=${demo.slug}`}
                onclick={onClose}
                class="flex items-center justify-between rounded-lg px-3 py-2 text-sm text-zinc-300 transition hover:bg-white/5 hover:text-white"
              >
                <div>
                  <div class="font-mono text-xs font-semibold text-white">{demo.title}</div>
                  <div class="line-clamp-1 text-xs text-zinc-400">{demo.shows}</div>
                </div>
                <span class="rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-[10px] text-zinc-400">
                  {demo.category}
                </span>
              </a>
            {/each}
          </div>
        </div>
      </div>

      <!-- Footer Info -->
      <div class="flex items-center justify-between border-t border-white/5 bg-zinc-950/60 px-4 py-2.5 text-[11px] text-zinc-500 font-mono">
        <div class="flex items-center gap-2">
          <span>Navigate with <kbd class="rounded border border-white/10 px-1">↑</kbd> <kbd class="rounded border border-white/10 px-1">↓</kbd></span>
        </div>
        <span>Press <kbd class="rounded border border-white/10 px-1">ESC</kbd> to close</span>
      </div>
    </div>
  </div>
{/if}
