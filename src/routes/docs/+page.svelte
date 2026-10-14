<script lang="ts">
  import {
    AlertTriangle,
    ArrowLeft,
    ArrowRight,
    BookOpen,
    Bot,
    Check,
    ChevronRight,
    ExternalLink,
    FileText,
    Hash,
    Info,
    Lightbulb,
    Menu,
    Search,
    Shield,
    X,
  } from 'lucide-svelte'
  import CodeBlock from '$lib/components/CodeBlock.svelte'
  import {
    getDocCategories,
    getDocSections,
    type DocCategory,
    type DocSection,
  } from '../../data/docs-loader'

  interface Props {
    slug?: string
  }

  let { slug }: Props = $props()

  const allSections = getDocSections()
  const categories = getDocCategories()

  let currentSlug = $state<string | null>(null)
  let selectedSlug = $derived(currentSlug ?? slug ?? allSections[0]?.slug ?? 'overview')
  let searchQuery = $state('')
  let searchInputEl: HTMLInputElement | undefined = $state()
  let isMobileMenuOpen = $state(false)
  let activeHeadingId = $state<string>('')

  // Sync if slug prop changes externally
  $effect(() => {
    if (slug) {
      currentSlug = slug
    }
  })

  let activeSection = $derived.by(() => {
    return allSections.find((s) => s.slug === selectedSlug) || allSections[0]
  })

  let currentIndex = $derived.by(() => {
    return allSections.findIndex((s) => s.slug === activeSection.slug)
  })

  let prevSection = $derived.by(() => {
    if (currentIndex > 0) return allSections[currentIndex - 1]
    return null
  })

  let nextSection = $derived.by(() => {
    if (currentIndex < allSections.length - 1) return allSections[currentIndex + 1]
    return null
  })

  function escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }

  let filteredCategories = $derived.by(() => {
    const q = searchQuery.trim()
    if (!q) return categories

    const tokens = q.split(/\s+/).filter(Boolean)
    const tokenRegexes = tokens.map((token) => new RegExp(escapeRegex(token), 'i'))
    const result: DocCategory[] = []

    for (const cat of categories) {
      const matchingItems = cat.items.filter((item) =>
        tokenRegexes.every(
          (regex) =>
            regex.test(item.title) ||
            regex.test(item.description) ||
            regex.test(item.content) ||
            regex.test(cat.name)
        )
      )
      if (matchingItems.length > 0) {
        result.push({
          name: cat.name,
          items: matchingItems,
        })
      }
    }
    return result
  })

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === '/' && document.activeElement !== searchInputEl) {
      e.preventDefault()
      searchInputEl?.focus()
    }
  }

  function selectDoc(docSlug: string) {
    currentSlug = docSlug
    isMobileMenuOpen = false
    if (typeof window !== 'undefined' && window.history) {
      window.history.pushState(null, '', `/docs/${docSlug}`)
    }
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  interface ParsedBlock {
    type: 'p' | 'callout' | 'code' | 'h2' | 'h3' | 'table' | 'ul' | 'ol'
    content?: string
    calloutType?: 'note' | 'tip' | 'warning' | 'important'
    calloutTitle?: string
    code?: string
    lang?: string
    headingId?: string
    tableHeaders?: string[]
    tableRows?: string[][]
    listItems?: string[]
  }

  function parseMarkdown(md: string): ParsedBlock[] {
    const lines = md.split('\n')
    const blocks: ParsedBlock[] = []
    let i = 0

    while (i < lines.length) {
      const line = lines[i]

      if (!line.trim()) {
        i++
        continue
      }

      // Skip title h1 since it's in header
      if (line.startsWith('# ')) {
        i++
        continue
      }

      // Callout box (> [!NOTE], > [!TIP], etc.)
      const calloutMatch = line.match(/^>\s*\[!(NOTE|TIP|WARNING|IMPORTANT)\]\s*(.*)$/i)
      if (calloutMatch) {
        const type = calloutMatch[1].toLowerCase() as 'note' | 'tip' | 'warning' | 'important'
        const initialText = calloutMatch[2].trim()
        const textLines: string[] = initialText ? [initialText] : []
        i++
        while (i < lines.length && lines[i].startsWith('>')) {
          textLines.push(lines[i].replace(/^>\s?/, ''))
          i++
        }
        blocks.push({
          type: 'callout',
          calloutType: type,
          calloutTitle: type.toUpperCase(),
          content: textLines.join('\n').trim(),
        })
        continue
      }

      // Code blocks (```lang ... ```)
      if (line.startsWith('```')) {
        const lang = line.replace(/^```/, '').trim() || 'typescript'
        const codeLines: string[] = []
        i++
        while (i < lines.length && !lines[i].startsWith('```')) {
          codeLines.push(lines[i])
          i++
        }
        if (i < lines.length && lines[i].startsWith('```')) {
          i++
        }
        blocks.push({
          type: 'code',
          lang,
          code: codeLines.join('\n'),
        })
        continue
      }

      // Headings (## or ###)
      if (line.startsWith('## ')) {
        const text = line.replace(/^##\s+/, '').trim()
        const headingId = text
          .toLowerCase()
          .replace(/[^a-z0-9\s-]/g, '')
          .trim()
          .replace(/\s+/g, '-')
        blocks.push({ type: 'h2', content: text, headingId })
        i++
        continue
      }

      if (line.startsWith('### ')) {
        const text = line.replace(/^###\s+/, '').trim()
        const headingId = text
          .toLowerCase()
          .replace(/[^a-z0-9\s-]/g, '')
          .trim()
          .replace(/\s+/g, '-')
        blocks.push({ type: 'h3', content: text, headingId })
        i++
        continue
      }

      // Table (| col | col |)
      if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
        const tableLines: string[] = []
        while (i < lines.length && lines[i].trim().startsWith('|') && lines[i].trim().endsWith('|')) {
          tableLines.push(lines[i])
          i++
        }
        if (tableLines.length >= 2) {
          const headerRow = tableLines[0]
            .split('|')
            .slice(1, -1)
            .map((s) => s.trim())
          const bodyRows = tableLines
            .slice(2)
            .map((r) => r.split('|').slice(1, -1).map((s) => s.trim()))
          blocks.push({
            type: 'table',
            tableHeaders: headerRow,
            tableRows: bodyRows,
          })
          continue
        }
      }

      // Lists
      if (line.match(/^[-*]\s+/)) {
        const items: string[] = []
        while (i < lines.length && lines[i].match(/^[-*]\s+/)) {
          items.push(lines[i].replace(/^[-*]\s+/, '').trim())
          i++
        }
        blocks.push({ type: 'ul', listItems: items })
        continue
      }

      if (line.match(/^\d+\.\s+/)) {
        const items: string[] = []
        while (i < lines.length && lines[i].match(/^\d+\.\s+/)) {
          items.push(lines[i].replace(/^\d+\.\s+/, '').trim())
          i++
        }
        blocks.push({ type: 'ol', listItems: items })
        continue
      }

      // Paragraph fallback: always advances at least 1 line
      const pLines: string[] = [line]
      i++
      while (
        i < lines.length &&
        lines[i].trim() &&
        !lines[i].startsWith('#') &&
        !lines[i].startsWith('```') &&
        !lines[i].startsWith('>') &&
        !lines[i].startsWith('|') &&
        !lines[i].match(/^[-*]\s+/) &&
        !lines[i].match(/^\d+\.\s+/)
      ) {
        pLines.push(lines[i])
        i++
      }
      blocks.push({ type: 'p', content: pLines.join(' ') })
    }

    return blocks
  }

  let parsedBlocks = $derived.by(() => {
    return parseMarkdown(activeSection.content)
  })
</script>

<svelte:window onkeydown={handleKeydown} />

<svelte:head>
  <title>{activeSection.title} — Automata Framework Documentation</title>
</svelte:head>

<div class="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
  <!-- Mobile drawer toggle -->
  <div class="mb-4 flex items-center justify-between border-b border-white/10 pb-4 lg:hidden">
    <button
      type="button"
      onclick={() => (isMobileMenuOpen = !isMobileMenuOpen)}
      class="flex items-center gap-2 rounded-lg border border-white/10 bg-zinc-900 px-3 py-1.5 font-mono text-xs text-zinc-300"
    >
      <Menu class="h-4 w-4 text-cyan-400" />
      <span>Menu & Sections</span>
    </button>
    <div class="font-mono text-xs text-zinc-400">
      {activeSection.title}
    </div>
  </div>

  <div class="grid grid-cols-1 gap-8 lg:grid-cols-12">
    <!-- LEFT SIDEBAR: Category Navigation & Instant Filter (col-span-3) -->
    <aside
      class={`fixed inset-y-0 left-0 z-50 w-72 transform bg-zinc-950 p-6 transition-transform lg:static lg:z-auto lg:w-auto lg:translate-x-0 lg:p-0 lg:col-span-3 ${
        isMobileMenuOpen ? 'translate-x-0 border-r border-white/10 shadow-2xl' : '-translate-x-full'
      }`}
    >
      <div class="sticky top-24 space-y-6">
        <!-- Close button on mobile -->
        <div class="flex items-center justify-between lg:hidden">
          <span class="font-mono text-xs font-bold uppercase tracking-wider text-cyan-400">Documentation</span>
          <button
            type="button"
            onclick={() => (isMobileMenuOpen = false)}
            class="rounded p-1 text-zinc-400 hover:text-white"
          >
            <X class="h-4 w-4" />
          </button>
        </div>

        <!-- Search / Filter Input -->
        <div class="relative">
          <Search class="pointer-events-none absolute left-3 top-2.5 h-3.5 w-3.5 text-zinc-500" />
          <input
            bind:this={searchInputEl}
            bind:value={searchQuery}
            type="text"
            placeholder="Search docs... (/)"
            class="w-full rounded-lg border border-white/10 bg-zinc-900/80 py-2 pl-9 pr-3 font-mono text-xs text-white placeholder-zinc-500 transition focus:border-cyan-500/50 focus:outline-none"
          />
        </div>

        <!-- Category Groups -->
        <nav class="max-h-[calc(100vh-14rem)] space-y-6 overflow-y-auto pr-2">
          {#each filteredCategories as category}
            <div class="space-y-2">
              <h3 class="font-mono text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                {category.name}
              </h3>
              <div class="space-y-0.5">
                {#each category.items as item}
                  <button
                    type="button"
                    onclick={() => selectDoc(item.slug)}
                    class={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left font-mono text-xs transition ${
                      selectedSlug === item.slug
                        ? 'border border-cyan-500/30 bg-cyan-500/10 font-bold text-cyan-300'
                        : 'border border-transparent text-zinc-400 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <span class="truncate">{item.title}</span>
                    {#if item.badge}
                      <span class="ml-2 shrink-0 rounded bg-zinc-800/80 px-1.5 py-0.2 text-[9px] text-zinc-400">
                        {item.badge}
                      </span>
                    {/if}
                  </button>
                {/each}
              </div>
            </div>
          {/each}
        </nav>
      </div>
    </aside>

    <!-- CENTER CANVAS: Long-form Prose Canvas (col-span-6 on lg, full on mobile) -->
    <main class="min-w-0 lg:col-span-6">
      <article class="space-y-6">
        <!-- Breadcrumbs & Category Eyebrow -->
        <div class="space-y-1">
          <div class="flex items-center gap-1.5 font-mono text-xs text-zinc-500">
            <span>Docs</span>
            <ChevronRight class="h-3 w-3" />
            <span>{activeSection.category}</span>
            <ChevronRight class="h-3 w-3" />
            <span class="text-zinc-300">{activeSection.title}</span>
          </div>

          <div class="font-mono text-xs font-semibold uppercase tracking-wider text-cyan-400 pt-2">
            {activeSection.category}
          </div>

          <h1 class="font-mono text-2xl font-bold tracking-tight text-white sm:text-4xl">
            {activeSection.title}
          </h1>

          <p class="text-sm text-zinc-400 pt-1 leading-relaxed">
            {activeSection.description}
          </p>
        </div>

        <div class="border-t border-white/10 pt-6"></div>

        <!-- Rendered Blocks -->
        <div class="space-y-6 text-sm text-zinc-300 leading-relaxed">
          {#each parsedBlocks as block}
            {#if block.type === 'p'}
              <p class="leading-relaxed text-zinc-300">{block.content}</p>
            {:else if block.type === 'h2'}
              <h2
                id={block.headingId}
                class="group flex items-center gap-2 pt-6 font-mono text-lg font-bold tracking-tight text-white sm:text-xl border-t border-white/5"
              >
                <span>{block.content}</span>
                <a
                  href={`#${block.headingId}`}
                  class="opacity-0 transition group-hover:opacity-100 text-cyan-400"
                  aria-label={`Link to ${block.content}`}
                >
                  <Hash class="h-4 w-4" />
                </a>
              </h2>
            {:else if block.type === 'h3'}
              <h3
                id={block.headingId}
                class="group flex items-center gap-2 pt-4 font-mono text-base font-bold text-white"
              >
                <span>{block.content}</span>
                <a
                  href={`#${block.headingId}`}
                  class="opacity-0 transition group-hover:opacity-100 text-cyan-400"
                  aria-label={`Link to ${block.content}`}
                >
                  <Hash class="h-3.5 w-3.5" />
                </a>
              </h3>
            {:else if block.type === 'code'}
              <CodeBlock code={block.code || ''} lang={block.lang || 'typescript'} />
            {:else if block.type === 'callout'}
              <div
                data-callout={block.calloutType}
                class={`rounded-xl border p-4 ${
                  block.calloutType === 'warning'
                    ? 'border-amber-500/30 bg-amber-500/5 text-amber-200'
                    : block.calloutType === 'tip'
                    ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-200'
                    : 'border-cyan-500/30 bg-cyan-500/5 text-cyan-200'
                }`}
              >
                <div class="flex items-center gap-2 font-mono text-xs font-bold uppercase tracking-wider mb-2">
                  {#if block.calloutType === 'warning'}
                    <AlertTriangle class="h-4 w-4 text-amber-400" />
                  {:else if block.calloutType === 'tip'}
                    <Lightbulb class="h-4 w-4 text-emerald-400" />
                  {:else}
                    <Info class="h-4 w-4 text-cyan-400" />
                  {/if}
                  <span>{block.calloutTitle}</span>
                </div>
                <div class="text-xs text-zinc-300 leading-relaxed whitespace-pre-line">
                  {block.content}
                </div>
              </div>
            {:else if block.type === 'table'}
              <div class="overflow-x-auto rounded-xl border border-white/10 bg-zinc-950 font-mono text-xs">
                <table class="w-full text-left">
                  <thead class="border-b border-white/10 bg-zinc-900/80 text-zinc-400">
                    <tr>
                      {#each block.tableHeaders || [] as th}
                        <th class="p-3 font-semibold">{th}</th>
                      {/each}
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-white/5 text-zinc-300">
                    {#each block.tableRows || [] as row}
                      <tr class="hover:bg-white/5 transition">
                        {#each row as cell}
                          <td class="p-3">{cell}</td>
                        {/each}
                      </tr>
                    {/each}
                  </tbody>
                </table>
              </div>
            {:else if block.type === 'ul'}
              <ul class="list-disc space-y-1.5 pl-5 text-zinc-300">
                {#each block.listItems || [] as item}
                  <li>{item}</li>
                {/each}
              </ul>
            {:else if block.type === 'ol'}
              <ol class="list-decimal space-y-1.5 pl-5 text-zinc-300">
                {#each block.listItems || [] as item}
                  <li>{item}</li>
                {/each}
              </ol>
            {/if}
          {/each}
        </div>

        <!-- Next / Prev Article Navigation Cards -->
        <div class="flex items-center justify-between border-t border-white/10 pt-8 mt-12">
          {#if prevSection}
            <button
              type="button"
              onclick={() => selectDoc(prevSection.slug)}
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
              onclick={() => selectDoc(nextSection.slug)}
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
      </article>
    </main>

    <!-- RIGHT SIDEBAR: "On this page" TOC & Quick Links (col-span-3) -->
    <aside class="hidden lg:block lg:col-span-3">
      <div class="sticky top-24 space-y-6">
        <div>
          <h3 class="font-mono text-xs font-semibold uppercase tracking-wider text-zinc-200">
            On this page
          </h3>
          <nav class="mt-3 space-y-1.5 font-mono text-xs">
            {#if activeSection.toc && activeSection.toc.length > 0}
              {#each activeSection.toc as item}
                <a
                  href={`#${item.id}`}
                  class={`block truncate transition ${
                    item.level === 3 ? 'pl-3 text-zinc-500 hover:text-zinc-300' : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  {item.text}
                </a>
              {/each}
            {:else}
              <span class="text-zinc-500 text-xs">No subheadings</span>
            {/if}
          </nav>
        </div>

        <div class="border-t border-white/10 pt-4 space-y-2.5 font-mono text-xs">
          <a
            href="https://github.com/mcthaydt/automata-framework/tree/main/docs"
            target="_blank"
            rel="noreferrer"
            class="flex items-center gap-2 text-zinc-400 transition hover:text-white"
          >
            <FileText class="h-3.5 w-3.5 text-cyan-400" />
            <span>Edit on GitHub</span>
            <ExternalLink class="h-3 w-3 opacity-60" />
          </a>

          <a
            href="/ai"
            class="flex items-center gap-2 text-cyan-300 transition hover:text-cyan-200"
          >
            <Bot class="h-3.5 w-3.5" />
            <span>AI Coding Rules</span>
          </a>

          <a
            href="/llms.txt"
            target="_blank"
            class="flex items-center gap-2 text-zinc-400 transition hover:text-white"
          >
            <ExternalLink class="h-3.5 w-3.5 text-zinc-500" />
            <span>View llms.txt</span>
          </a>
        </div>
      </div>
    </aside>
  </div>
</div>
