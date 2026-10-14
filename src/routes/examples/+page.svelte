<script lang="ts">
  import {
    Box,
    Check,
    ChevronRight,
    Code,
    ExternalLink,
    Filter,
    Gamepad2,
    Layers,
    Package,
    Play,
    Sliders,
  } from 'lucide-svelte'
  import CodeBlock from '$lib/components/CodeBlock.svelte'
  import DemoRunner from '$lib/components/DemoRunner.svelte'
  import { DEMO_CATEGORIES, getDemosCatalog, type DemoItem } from '../../data/demos'

  const allDemos = getDemosCatalog()

  let selectedCategory = $state('All Examples')
  let selectedDemoSlug = $state(allDemos[0]?.slug || 'renderer-2d')

  let filteredDemos = $derived.by(() => {
    if (selectedCategory === 'All Examples') return allDemos
    return allDemos.filter((d) => d.category === selectedCategory)
  })

  let currentDemo = $derived.by(() => {
    return allDemos.find((d) => d.slug === selectedDemoSlug) || allDemos[0]
  })

  function selectDemo(demo: DemoItem) {
    selectedDemoSlug = demo.slug
  }
</script>

<svelte:head>
  <title>Examples Gallery — Automata Framework</title>
</svelte:head>

<div class="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
  <!-- Page Header -->
  <div class="border-b border-white/10 pb-6">
    <div class="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
      <div>
        <h1 class="font-mono text-2xl font-bold tracking-tight text-white sm:text-3xl">
          Examples Gallery
        </h1>
        <p class="mt-1 text-sm text-zinc-400">
          Standalone, runnable raylib-style feature demonstrations. Pure TypeScript, zero visual helpers.
        </p>
      </div>

      <!-- Category Filter Pills -->
      <div class="flex flex-wrap items-center gap-1.5 pt-2 md:pt-0">
        {#each DEMO_CATEGORIES as category}
          <button
            type="button"
            onclick={() => (selectedCategory = category)}
            class={`rounded-lg px-3 py-1 font-mono text-xs transition ${
              selectedCategory === category
                ? 'bg-cyan-400 font-semibold text-zinc-950 shadow-md'
                : 'border border-white/5 bg-zinc-900/60 text-zinc-400 hover:border-white/15 hover:text-white'
            }`}
          >
            {category}
          </button>
        {/each}
      </div>
    </div>
  </div>

  <!-- Main Split Layout -->
  <div class="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-12">
    <!-- Left Column: Demo Selector & Interactive Runner (5 cols on lg) -->
    <div class="space-y-6 lg:col-span-5">
      <!-- Demo Selector List (Pill Drawer) -->
      <div class="flex flex-col gap-1 rounded-xl border border-white/10 bg-zinc-900/40 p-2 backdrop-blur">
        <div class="px-3 py-1.5 font-mono text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
          Select Feature Demo ({filteredDemos.length})
        </div>
        <div class="flex flex-col gap-1 max-h-56 overflow-y-auto">
          {#each filteredDemos as demo}
            <button
              type="button"
              onclick={() => selectDemo(demo)}
              class={`flex items-center justify-between rounded-lg px-3 py-2 text-left font-mono text-xs transition ${
                selectedDemoSlug === demo.slug
                  ? 'bg-cyan-500/10 text-cyan-300 border border-cyan-500/20'
                  : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-200 border border-transparent'
              }`}
            >
              <div class="flex items-center gap-2.5 truncate">
                <Play class={`h-3 w-3 shrink-0 ${selectedDemoSlug === demo.slug ? 'text-cyan-400 fill-current' : 'text-zinc-600'}`} />
                <span class="truncate font-medium">{demo.title}</span>
              </div>
              <span class="rounded bg-zinc-800/80 px-1.5 py-0.5 text-[10px] text-zinc-400">
                {demo.category}
              </span>
            </button>
          {/each}
        </div>
      </div>

      <!-- Live Interactive Sandbox Player -->
      {#if currentDemo}
        <div>
          <DemoRunner
            src={currentDemo.bundleUrl}
            title={currentDemo.title}
            aspect="aspect-[4/3]"
          />
        </div>

        <!-- Raylib Canonical Metadata Card -->
        <div class="rounded-xl border border-white/10 bg-zinc-900/60 p-5 space-y-3 font-mono text-xs">
          <div class="flex items-center justify-between border-b border-white/5 pb-2">
            <span class="text-zinc-500 uppercase tracking-wider font-semibold text-[11px]">Demo Specification</span>
            <span class="rounded bg-zinc-800 px-2 py-0.5 text-[11px] text-zinc-300">Base: {currentDemo.base}</span>
          </div>

          <div class="space-y-2">
            <div>
              <span class="text-cyan-400 font-semibold">Shows: </span>
              <span class="text-zinc-300">{currentDemo.shows}</span>
            </div>
            <div>
              <span class="text-amber-400 font-semibold">Controls: </span>
              <span class="text-zinc-300">{currentDemo.controls}</span>
            </div>
          </div>

          <div class="pt-2 border-t border-white/5">
            <div class="text-[11px] text-zinc-500 mb-1.5">Packages Utilized:</div>
            <div class="flex flex-wrap gap-1.5">
              {#each currentDemo.packages as pkg}
                <span class="inline-flex items-center gap-1 rounded border border-white/10 bg-zinc-800/80 px-2 py-0.5 text-[11px] text-zinc-300">
                  <Package class="h-3 w-3 text-cyan-400" />
                  <span>{pkg}</span>
                </span>
              {/each}
            </div>
          </div>
        </div>
      {/if}
    </div>

    <!-- Right Column: Source Code Viewer (7 cols on lg) -->
    <div class="space-y-4 lg:col-span-7">
      {#if currentDemo}
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <Code class="h-4 w-4 text-cyan-400" />
            <h2 class="font-mono text-sm font-bold text-white">Source: {currentDemo.path}/main.ts</h2>
          </div>
          <a
            href={`https://github.com/mcthaydt/automata-framework/tree/main/${currentDemo.path}/main.ts`}
            target="_blank"
            rel="noreferrer"
            class="inline-flex items-center gap-1 text-xs font-mono text-zinc-400 transition hover:text-white"
          >
            <span>GitHub</span>
            <ExternalLink class="h-3 w-3" />
          </a>
        </div>

        <!-- Highlighted Code Viewer -->
        <CodeBlock
          code={currentDemo.sourceCode}
          filename={`${currentDemo.slug}/main.ts`}
          lang="typescript"
          class="max-h-[750px] overflow-y-auto"
        />
      {/if}
    </div>
  </div>
</div>
