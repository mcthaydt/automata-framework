<script lang="ts">
  import { Github, MessageSquare, Search, Terminal } from 'lucide-svelte'

  interface Props {
    onOpenSearch?: () => void
  }

  let { onOpenSearch }: Props = $props()
</script>

<header class="sticky top-0 z-40 w-full border-b border-white/10 bg-zinc-950/80 backdrop-blur-md">
  <div class="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
    <!-- Brand -->
    <div class="flex items-center gap-6">
      <a href="/" class="flex items-center gap-2.5 transition opacity-90 hover:opacity-100">
        <div class="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-zinc-900 shadow-inner">
          <Terminal class="h-4 w-4 text-cyan-400" />
        </div>
        <span class="font-mono text-base font-bold tracking-tight text-white">automata</span>
        <span class="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-2 py-0.5 font-mono text-[10px] font-medium text-cyan-300">
          v0.0.2
        </span>
      </a>

      <!-- Desktop Nav -->
      <nav class="hidden md:flex items-center gap-1">
        <a href="/" class="rounded-md px-3 py-1.5 text-sm font-medium text-zinc-300 transition hover:bg-white/5 hover:text-white">
          Overview
        </a>
        <a href="/examples" class="rounded-md px-3 py-1.5 text-sm font-medium text-zinc-300 transition hover:bg-white/5 hover:text-white">
          Examples
        </a>
        <a href="/cheatsheet" class="rounded-md px-3 py-1.5 text-sm font-medium text-zinc-300 transition hover:bg-white/5 hover:text-white">
          Cheatsheet
        </a>
        <a href="/showcase" class="rounded-md px-3 py-1.5 text-sm font-medium text-zinc-300 transition hover:bg-white/5 hover:text-white">
          Showcase
        </a>
        <a href="/docs" class="rounded-md px-3 py-1.5 text-sm font-medium text-zinc-300 transition hover:bg-white/5 hover:text-white">
          Docs
        </a>
        <a href="/ai" class="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-cyan-300 transition hover:bg-white/5 hover:text-cyan-200">
          <span>AI</span>
          <span class="rounded bg-cyan-500/20 px-1 py-0.2 font-mono text-[9px] uppercase tracking-wider text-cyan-300">New</span>
        </a>
      </nav>
    </div>

    <!-- Right Actions -->
    <div class="flex items-center gap-3">
      <!-- Search Button (Cmd+K) -->
      <button
        type="button"
        onclick={onOpenSearch}
        class="flex items-center gap-2 rounded-lg border border-white/10 bg-zinc-900/80 px-3 py-1.5 text-xs text-zinc-400 transition hover:border-white/20 hover:text-zinc-200"
      >
        <Search class="h-3.5 w-3.5" />
        <span class="hidden sm:inline">Search docs & API...</span>
        <kbd class="rounded border border-white/10 bg-zinc-800 px-1.5 py-0.5 font-mono text-[10px] text-zinc-400">⌘K</kbd>
      </button>

      <!-- Discord -->
      <a
        href="https://discord.gg/automata"
        target="_blank"
        rel="noreferrer"
        aria-label="Discord"
        class="hidden sm:inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-zinc-900 text-zinc-400 transition hover:bg-zinc-800 hover:text-white"
      >
        <MessageSquare class="h-4 w-4" />
      </a>

      <!-- GitHub -->
      <a
        href="https://github.com/mcthaydt/automata-framework"
        target="_blank"
        rel="noreferrer"
        aria-label="GitHub"
        class="inline-flex h-8 items-center gap-2 rounded-lg border border-white/10 bg-zinc-900 px-3 text-xs font-medium text-zinc-200 transition hover:bg-zinc-800 hover:text-white"
      >
        <Github class="h-4 w-4" />
        <span class="hidden sm:inline">GitHub</span>
      </a>
    </div>
  </div>
</header>
