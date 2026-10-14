<script lang="ts">
  import {
    ArrowLeft,
    ArrowRight,
    BookOpen,
    ChevronRight,
    ExternalLink,
    FileText,
    Hash,
    Layers,
    Shield,
  } from 'lucide-svelte'
  import CodeBlock from '$lib/components/CodeBlock.svelte'
  import { getDocSections, type DocSection } from '../../data/docs-loader'

  const sections = getDocSections()
  let selectedSlug = $state(sections[0].slug)

  let activeSection = $derived.by(() => {
    return sections.find((s) => s.slug === selectedSlug) || sections[0]
  })

  let currentIndex = $derived.by(() => {
    return sections.findIndex((s) => s.slug === activeSection.slug)
  })

  let prevSection = $derived.by(() => {
    if (currentIndex > 0) return sections[currentIndex - 1]
    return null
  })

  let nextSection = $derived.by(() => {
    if (currentIndex < sections.length - 1) return sections[currentIndex + 1]
    return null
  })
</script>

<svelte:head>
  <title>{activeSection.title} — Automata Documentation</title>
</svelte:head>

<div class="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
  <div class="grid grid-cols-1 gap-8 lg:grid-cols-12">
    <!-- Left Navigation Sidebar (3 cols on lg) -->
    <aside class="space-y-6 lg:col-span-3">
      <div class="sticky top-24 space-y-4">
        <div>
          <h2 class="font-mono text-xs font-semibold uppercase tracking-wider text-cyan-400">
            Spartan Documentation
          </h2>
          <p class="mt-1 text-xs text-zinc-400">
            Architecture laws & developer guides.
          </p>
        </div>

        <nav class="space-y-1">
          {#each sections as section}
            <button
              type="button"
              onclick={() => (selectedSlug = section.slug)}
              class={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left font-mono text-xs transition ${
                selectedSlug === section.slug
                  ? 'bg-cyan-500/10 font-bold text-cyan-300 border border-cyan-500/20'
                  : 'text-zinc-400 hover:bg-white/5 hover:text-white border border-transparent'
              }`}
            >
              <div class="flex items-center gap-2.5 truncate">
                <FileText class="h-3.5 w-3.5 shrink-0" />
                <span class="truncate">{section.title}</span>
              </div>
              {#if selectedSlug === section.slug}
                <ChevronRight class="h-3.5 w-3.5 text-cyan-400" />
              {/if}
            </button>
          {/each}
        </nav>
      </div>
    </aside>

    <!-- Main Content Reader (9 cols on lg) -->
    <main class="lg:col-span-9 max-w-4xl space-y-8">
      <!-- Breadcrumb & GitHub Link -->
      <div class="flex items-center justify-between border-b border-white/5 pb-4 text-xs font-mono text-zinc-500">
        <div class="flex items-center gap-2">
          <span>Docs</span>
          <ChevronRight class="h-3 w-3" />
          <span class="text-zinc-300">{activeSection.title}</span>
        </div>
        <a
          href="https://github.com/mcthaydt/automata-framework/tree/main/docs"
          target="_blank"
          rel="noreferrer"
          class="flex items-center gap-1 text-zinc-400 transition hover:text-white"
        >
          <span>Source docs</span>
          <ExternalLink class="h-3 w-3" />
        </a>
      </div>

      <!-- Document Content Body -->
      <article class="prose prose-invert max-w-none space-y-6">
        <div class="rounded-2xl border border-white/10 bg-zinc-900/40 p-6 sm:p-8 backdrop-blur space-y-6">
          <div class="border-b border-white/10 pb-4">
            <h1 class="font-mono text-2xl font-bold tracking-tight text-white sm:text-3xl">
              {activeSection.title}
            </h1>
            <p class="mt-2 text-sm text-zinc-400 font-mono">
              {activeSection.description}
            </p>
          </div>

          <!-- Formatted Content Lines -->
          <div class="space-y-4 text-sm leading-relaxed text-zinc-300 font-sans">
            {#each activeSection.content.split('\n\n') as block}
              {#if block.startsWith('# ')}
                <!-- Title is already rendered in header -->
              {:else if block.startsWith('## ')}
                <h2 class="mt-8 mb-3 font-mono text-lg font-bold tracking-tight text-white flex items-center gap-2 border-b border-white/5 pb-2">
                  <Hash class="h-4 w-4 text-cyan-400" />
                  <span>{block.replace(/^## /, '')}</span>
                </h2>
              {:else if block.startsWith('```')}
                {@const code = block.replace(/^```[a-z]*\n/, '').replace(/\n```$/, '')}
                <CodeBlock {code} lang="typescript" />
              {:else if block.startsWith('- ')}
                <ul class="space-y-1.5 pl-4 list-disc list-outside text-zinc-300 font-mono text-xs">
                  {#each block.split('\n') as item}
                    <li>{item.replace(/^- /, '')}</li>
                  {/each}
                </ul>
              {:else if block.startsWith('1. ')}
                <ol class="space-y-2 pl-4 list-decimal list-outside text-zinc-300 font-mono text-xs">
                  {#each block.split('\n') as item}
                    <li>{item.replace(/^\d+\.\s*/, '')}</li>
                  {/each}
                </ol>
              {:else}
                <p class="text-zinc-300 leading-relaxed">{block}</p>
              {/if}
            {/each}
          </div>
        </div>
      </article>

      <!-- Chapter Navigation Footers (Prev / Next) -->
      <div class="flex items-center justify-between border-t border-white/10 pt-6">
        {#if prevSection}
          <button
            type="button"
            onclick={() => (selectedSlug = prevSection.slug)}
            class="flex items-center gap-3 rounded-xl border border-white/10 bg-zinc-900/60 p-4 text-left font-mono transition hover:border-white/20 hover:bg-zinc-800"
          >
            <ArrowLeft class="h-4 w-4 text-cyan-400" />
            <div>
              <div class="text-[10px] uppercase text-zinc-500">Previous</div>
              <div class="text-xs font-bold text-white">{prevSection.title}</div>
            </div>
          </button>
        {:else}
          <div></div>
        {/if}

        {#if nextSection}
          <button
            type="button"
            onclick={() => (selectedSlug = nextSection.slug)}
            class="flex items-center gap-3 rounded-xl border border-white/10 bg-zinc-900/60 p-4 text-right font-mono transition hover:border-white/20 hover:bg-zinc-800"
          >
            <div>
              <div class="text-[10px] uppercase text-zinc-500">Next</div>
              <div class="text-xs font-bold text-white">{nextSection.title}</div>
            </div>
            <ArrowRight class="h-4 w-4 text-cyan-400" />
          </button>
        {/if}
      </div>
    </main>
  </div>
</div>
