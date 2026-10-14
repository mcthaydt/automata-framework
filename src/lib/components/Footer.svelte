<script lang="ts">
  import { Terminal, Heart } from 'lucide-svelte'
</script>

<footer class="border-t border-white/10 bg-zinc-950 py-12 text-zinc-400">
  <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
    <div class="grid grid-cols-1 gap-8 md:grid-cols-4">
      <!-- Col 1: Brand -->
      <div class="space-y-4 md:col-span-2">
        <div class="flex items-center gap-2.5">
          <div class="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-zinc-900">
            <Terminal class="h-3.5 w-3.5 text-cyan-400" />
          </div>
          <span class="font-mono text-base font-bold text-white">automata</span>
        </div>
        <p class="max-w-sm text-sm text-zinc-400">
          The deterministic, web-first game framework. Pure synchronous ECS simulation, PixiJS 2D/3D rendering, and Effect boundaries.
        </p>
        <p class="text-xs text-zinc-500">
          Inspired by Raylib's spartan design philosophy. Styled for modern developers.
        </p>
      </div>

      <!-- Col 2: Navigation -->
      <div class="space-y-3">
        <h3 class="text-xs font-semibold uppercase tracking-wider text-zinc-200">Framework</h3>
        <ul class="space-y-2 text-sm">
          <li><a href="/" class="transition hover:text-white">Overview</a></li>
          <li><a href="/examples" class="transition hover:text-white">Examples Gallery</a></li>
          <li><a href="/cheatsheet" class="transition hover:text-white">API Cheatsheet</a></li>
          <li><a href="/showcase" class="transition hover:text-white">Game Showcase</a></li>
          <li><a href="/docs" class="transition hover:text-white">Spartan Docs</a></li>
        </ul>
      </div>

      <!-- Col 3: Ecosystem -->
      <div class="space-y-3">
        <h3 class="text-xs font-semibold uppercase tracking-wider text-zinc-200">Ecosystem</h3>
        <ul class="space-y-2 text-sm">
          <li>
            <a href="https://github.com/mcthaydt/automata-framework" target="_blank" rel="noreferrer" class="transition hover:text-white">
              GitHub Repository
            </a>
          </li>
          <li>
            <a href="https://discord.gg/automata" target="_blank" rel="noreferrer" class="transition hover:text-white">
              Community Discord
            </a>
          </li>
          <li>
            <a href="https://github.com/mcthaydt/RukenApp" target="_blank" rel="noreferrer" class="transition hover:text-white">
              Ruken App Platform
            </a>
          </li>
          <li>
            <a href="https://lospec.com/palette-list/endesga-64" target="_blank" rel="noreferrer" class="transition hover:text-white">
              Endesga 64 Palette
            </a>
          </li>
        </ul>
      </div>
    </div>

    <div class="mt-12 flex flex-col items-center justify-between gap-4 border-t border-white/5 pt-8 text-xs text-zinc-500 sm:flex-row">
      <p>© {new Date().getFullYear()} Automata Framework. Built for creators.</p>
      <div class="flex items-center gap-4">
        <span>UNLICENSED (Developer Preview)</span>
        <span>•</span>
        <span class="inline-flex items-center gap-1">
          Crafted with <Heart class="h-3 w-3 text-red-500 fill-red-500" /> for games
        </span>
      </div>
    </div>
  </div>
</footer>
