<script lang="ts">
  import {
    ArrowRight,
    CheckCircle2,
    Code,
    ExternalLink,
    Gamepad2,
    Github,
    Play,
    Sparkles,
    X,
  } from 'lucide-svelte'
  import DemoRunner from '$lib/components/DemoRunner.svelte'
  import { SHOWCASE_GAMES, type ShowcaseGame } from '../../data/showcase'

  let activeModalGame = $state<ShowcaseGame | null>(null)

  function openGame(game: ShowcaseGame) {
    if (game.bundleUrl) {
      activeModalGame = game
    } else if (game.externalUrl) {
      window.open(game.externalUrl, '_blank')
    }
  }

  function closeModal() {
    activeModalGame = null
  }
</script>

<svelte:head>
  <title>Games Showcase — Automata Framework</title>
</svelte:head>

<div class="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
  <!-- Header -->
  <div class="border-b border-white/10 pb-8 text-center sm:text-left">
    <div class="inline-flex items-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 font-mono text-xs text-cyan-300 mb-3">
      <Gamepad2 class="h-3.5 w-3.5" />
      <span>Made with Automata</span>
    </div>
    <h1 class="font-mono text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
      Games Showcase
    </h1>
    <p class="mt-2 max-w-2xl text-sm text-zinc-400">
      Real games, experimental reference scenes, and starter templates powered by Automata's deterministic ECS and PixiJS rendering.
    </p>
  </div>

  <!-- Games Grid -->
  <div class="mt-10 grid grid-cols-1 gap-8 lg:grid-cols-3">
    {#each SHOWCASE_GAMES as game}
      <div class="flex flex-col justify-between overflow-hidden rounded-2xl border border-white/10 bg-zinc-900/60 shadow-xl backdrop-blur transition hover:border-white/20 hover:bg-zinc-900/80">
        <!-- Card Top & Banner -->
        <div>
          <!-- Visual Header -->
          <div class="relative aspect-video w-full border-b border-white/10 bg-zinc-950 flex flex-col items-center justify-center p-6 text-center overflow-hidden">
            <div class="absolute inset-0 bg-radial-gradient from-cyan-500/10 via-transparent to-transparent opacity-50"></div>
            <div class="relative z-10 flex h-12 w-12 items-center justify-center rounded-xl border border-white/10 bg-zinc-900 text-cyan-400 mb-2">
              <Gamepad2 class="h-6 w-6" />
            </div>
            <span class="relative z-10 font-mono text-xs text-zinc-500 uppercase tracking-widest">{game.dimension} Experience</span>
          </div>

          <!-- Body Content -->
          <div class="p-6 space-y-4">
            <div class="space-y-1">
              <div class="flex items-center justify-between">
                <h3 class="font-mono text-xl font-bold text-white">{game.title}</h3>
                <span class="rounded bg-zinc-800 px-2 py-0.5 font-mono text-xs font-semibold text-cyan-400">
                  {game.dimension}
                </span>
              </div>
              <p class="text-xs font-medium text-cyan-300 font-mono">{game.tagline}</p>
            </div>

            <p class="text-xs leading-relaxed text-zinc-400">{game.description}</p>

            <!-- Highlights -->
            <div class="space-y-2 pt-2 border-t border-white/5">
              <div class="font-mono text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">Highlights</div>
              <ul class="space-y-1.5 text-xs text-zinc-300 font-mono">
                {#each game.highlights as hl}
                  <li class="flex items-start gap-2">
                    <CheckCircle2 class="h-3.5 w-3.5 shrink-0 text-cyan-400 mt-0.5" />
                    <span>{hl}</span>
                  </li>
                {/each}
              </ul>
            </div>
          </div>
        </div>

        <!-- Card Footer Actions -->
        <div class="border-t border-white/10 bg-zinc-950/60 p-4 flex items-center justify-between gap-3">
          {#if game.bundleUrl}
            <button
              type="button"
              onclick={() => openGame(game)}
              class="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-cyan-400 px-4 py-2 font-mono text-xs font-bold text-zinc-950 transition hover:bg-cyan-300 shadow-lg shadow-cyan-500/10"
            >
              <Play class="h-3.5 w-3.5 fill-current" />
              <span>Play in Browser</span>
            </button>
          {:else if game.externalUrl}
            <a
              href={game.externalUrl}
              target="_blank"
              rel="noreferrer"
              class="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-white/10 bg-zinc-800 px-4 py-2 font-mono text-xs font-medium text-white transition hover:bg-zinc-700"
            >
              <span>Explore Project</span>
              <ExternalLink class="h-3.5 w-3.5" />
            </a>
          {/if}

          {#if game.repoUrl}
            <a
              href={game.repoUrl}
              target="_blank"
              rel="noreferrer"
              aria-label="View source repository"
              title="View repository"
              class="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-zinc-900 text-zinc-400 transition hover:bg-zinc-800 hover:text-white"
            >
              <Github class="h-4 w-4" />
            </a>
          {/if}
        </div>
      </div>
    {/each}
  </div>

  <!-- Submit Your Game CTA Banner -->
  <div class="mt-16 rounded-2xl border border-white/10 bg-zinc-900/40 p-8 text-center backdrop-blur">
    <h3 class="font-mono text-lg font-bold text-white">Built a game on Automata?</h3>
    <p class="mx-auto mt-2 max-w-lg text-sm text-zinc-400">
      We feature community games, open source starters, and commercial titles built on the framework. Share your project with the community.
    </p>
    <div class="mt-6 flex flex-wrap justify-center gap-4">
      <a
        href="https://discord.gg/automata"
        target="_blank"
        rel="noreferrer"
        class="inline-flex items-center gap-2 rounded-lg bg-zinc-800 px-4 py-2 font-mono text-xs font-medium text-white transition hover:bg-zinc-700"
      >
        <span>Join Discord Showcase</span>
        <ArrowRight class="h-3.5 w-3.5" />
      </a>
      <a
        href="https://github.com/mcthaydt/automata-framework"
        target="_blank"
        rel="noreferrer"
        class="inline-flex items-center gap-2 rounded-lg border border-white/10 px-4 py-2 font-mono text-xs text-zinc-300 transition hover:bg-white/5 hover:text-white"
      >
        <span>Submit via GitHub</span>
      </a>
    </div>
  </div>
</div>

<!-- Playable In-Browser Modal -->
{#if activeModalGame && activeModalGame.bundleUrl}
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md"
    onclick={closeModal}
    onkeydown={(e) => e.key === 'Escape' && closeModal()}
    role="dialog"
    tabindex="-1"
    aria-modal="true"
    aria-label="Play Game Modal"
  >
    <!-- Modal Dialog Window -->
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <div
      class="w-full max-w-4xl overflow-hidden rounded-2xl border border-white/10 bg-zinc-950 shadow-2xl"
      onclick={(e) => e.stopPropagation()}
      role="document"
    >
      <div class="flex items-center justify-between border-b border-white/10 bg-zinc-900 px-4 py-3 font-mono text-xs">
        <span class="font-bold text-white">{activeModalGame.title} (Live Web Sandbox)</span>
        <button
          type="button"
          onclick={closeModal}
          class="rounded p-1 text-zinc-400 transition hover:bg-white/5 hover:text-white"
          aria-label="Close modal"
        >
          <X class="h-4 w-4" />
        </button>
      </div>

      <div class="p-4">
        <DemoRunner
          src={activeModalGame.bundleUrl}
          title={activeModalGame.title}
          aspect="aspect-[16/10]"
        />
      </div>
    </div>
  </div>
{/if}
