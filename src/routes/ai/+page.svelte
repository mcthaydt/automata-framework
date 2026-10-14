<script lang="ts">
  import {
    ArrowRight,
    Bot,
    Check,
    Code,
    Copy,
    Cpu,
    ExternalLink,
    FileText,
    Layers,
    ShieldAlert,
    Sparkles,
    Terminal,
    Zap,
  } from 'lucide-svelte'
  import CodeBlock from '$lib/components/CodeBlock.svelte'

  type AgentTab = 'skills' | 'claude' | 'cursor' | 'windsurf' | 'antigravity'

  let activeTab = $state<AgentTab>('skills')
  let copiedCommand = $state<string | null>(null)

  const AGENT_CONFIGS: Record<
    AgentTab,
    { name: string; command: string; desc: string; filename?: string; snippet?: string }
  > = {
    skills: {
      name: 'Skills CLI',
      command: 'npx skills add mcthaydt/automata',
      desc: 'Installs official Automata skills into any compatible agent CLI following the Agent Skills open standard.',
    },
    claude: {
      name: 'Claude Code',
      command: 'claude /plugin marketplace add mcthaydt/automata',
      desc: 'Adds the official Automata skill package to Claude Code so it automatically enforces Koota ECS determinism and zero-eval CSP.',
    },
    cursor: {
      name: 'Cursor',
      command: 'curl -fsSL https://automata.dev/llms.txt >> .cursorrules',
      desc: 'Append official Automata rules to your project .cursorrules file or link the remote repository in Cursor Settings.',
      filename: '.cursorrules',
      snippet: `// Automata Framework Core Rules for Cursor
- Pure Koota ECS: Never import Effect or DOM inside packages/sim
- Zero Eval CSP: No eval() or new Function() in shaders or schemas
- Sub-tick Alpha Interpolation: x_rendered = prev.x + (curr.x - prev.x) * alpha
- State Ownership: Only the sim mutates entity components`,
    },
    windsurf: {
      name: 'Windsurf',
      command: 'curl -fsSL https://automata.dev/llms.txt >> .windsurfrules',
      desc: 'Add Automata instructions directly to your Windsurf Cascades engine.',
      filename: '.windsurfrules',
      snippet: `// Automata Framework Rules for Windsurf
- All side effects (I/O, audio, network, saves) run in Effect outside the sim
- Deterministic 60Hz loop: Synchronous ECS query execution only
- PixiJS v8 presentation observes RenderDelta`,
    },
    antigravity: {
      name: 'Antigravity',
      command: 'agy skill install mcthaydt/automata',
      desc: 'Installs the specialized Automata Engine pair-programming skill into Antigravity CLI and IDE.',
    },
  }

  const GOLDEN_RULES = [
    {
      num: 1,
      title: 'Pure Deterministic ECS',
      tagline: 'The simulation is pure, synchronous, and isolated.',
      rule: 'NEVER import Effect, browser DOM (window/document), or PixiJS inside simulation systems or packages/sim.',
      correct: 'world.query(Position, Velocity).each(([pos, vel]) => { pos.x += vel.vx })',
      wrong: "import { Effect } from 'effect'; import { Container } from 'pixi.js'",
    },
    {
      num: 2,
      title: 'Effect Outside the Sim',
      tagline: 'Structured concurrency owns all side effects.',
      rule: 'All timers, network calls, asset loads, and persistent saves belong in Effect outside the simulation loop.',
      correct: "const saveTask = Effect.gen(function* () { yield* host.save(data) })",
      wrong: "setInterval(() => saveStateToDisk(), 1000) // in sim loop",
    },
    {
      num: 3,
      title: 'Zero Eval CSP',
      tagline: '100% compliant with strict Content Security Policy.',
      rule: 'NEVER generate eval(), new Function(), or dynamic code evaluation. It breaks Ruken and throws EvalError.',
      correct: "import '@mcthaydt/automata-render-pixi/no-eval'; // static shader program linker",
      wrong: "const shaderFn = new Function('uv', 'return uv.x * 2.0')",
    },
    {
      num: 4,
      title: 'Sub-tick Interpolation',
      tagline: 'Silky smooth presentation on 120Hz/144Hz/240Hz monitors.',
      rule: 'Entity views must interpolate positions between previous and current ticks using alpha = accumulator / dt.',
      correct: 'sprite.x = prev.x + (curr.x - prev.x) * alpha',
      wrong: 'sprite.x = curr.x // causes visual judder on high-refresh monitors',
    },
    {
      num: 5,
      title: 'Single State Ownership',
      tagline: 'Only the simulation mutates gameplay truth.',
      rule: 'Presentation (PixiJS) and UI (Svelte) observe RenderDelta but never directly mutate game entities.',
      correct: 'renderer.apply(delta); renderer.draw({ alpha })',
      wrong: 'playerSprite.on("click", () => { playerEntity.hp -= 10 })',
    },
  ]

  const PROMPT_TEMPLATES = [
    {
      title: 'New 2D Game Project',
      desc: 'Prompts an AI agent to scaffold a complete character-in-a-room game loop.',
      prompt: `Create a new 2D Automata game with:
1. Pure Koota ECS simulation with Position, Velocity, and Input traits
2. A fixed 60Hz movement system
3. PixiJS v8 entity view with sub-tick alpha interpolation
4. Effect runtime entry with typed error recovery and zero eval compliance`,
    },
    {
      title: 'Deterministic ECS System',
      desc: 'Creates a clean, pure simulation system with zero external side effects.',
      prompt: `Write a pure Automata simulation system for 2D projectile collision:
- Query entities with [Position, Velocity, ProjectileTag]
- Check bounding box against [Position, EnemyTag]
- Record HitEvent on collision without mutating DOM or invoking Effect
- Keep the loop 100% deterministic and synchronous`,
    },
    {
      title: 'Sub-Tick PixiJS View',
      desc: 'Implements an EntityView with sub-tick alpha position and rotation interpolation.',
      prompt: `Implement an Automata EntityView for a spaceship:
- Consumes previous and current Transform components
- Interpolates position: prev.pos + (curr.pos - prev.pos) * alpha
- Interpolates angle with shortest-arc rotation
- Renders via PixiJS Graphics without new Function or dynamic shader evals`,
    },
  ]

  async function copyToClipboard(text: string) {
    try {
      await navigator.clipboard.writeText(text)
      copiedCommand = text
      setTimeout(() => {
        if (copiedCommand === text) copiedCommand = null
      }, 2000)
    } catch (_e) {
      copiedCommand = text
      setTimeout(() => {
        if (copiedCommand === text) copiedCommand = null
      }, 2000)
    }
  }
</script>

<svelte:head>
  <title>Automata AI & Agent Skills — Documentation & Tools for LLMs</title>
</svelte:head>

<div class="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
  <!-- Hero Section -->
  <div class="relative overflow-hidden rounded-2xl border border-white/10 bg-zinc-950/80 p-8 sm:p-12">
    <div class="relative z-10 max-w-3xl space-y-4">
      <div class="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 font-mono text-xs text-cyan-300">
        <Sparkles class="h-3.5 w-3.5" />
        <span>Official AI & LLM Integration</span>
      </div>

      <h1 class="font-mono text-3xl font-bold tracking-tight text-white sm:text-5xl">
        Automata AI & Agent Skills
      </h1>

      <p class="text-base text-zinc-300 sm:text-lg leading-relaxed">
        Equip <span class="text-white font-medium">Claude Code</span>, <span class="text-white font-medium">Cursor</span>, <span class="text-white font-medium">Windsurf</span>, and <span class="text-white font-medium">Antigravity</span> with official Automata framework rules. Eliminate hallucinations, enforce deterministic ECS laws, and guarantee zero-eval CSP compliance.
      </p>

      <div class="flex flex-wrap items-center gap-4 pt-4">
        <a
          href="/llms.txt"
          target="_blank"
          class="inline-flex items-center gap-2 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-4 py-2 font-mono text-xs font-semibold text-cyan-300 transition hover:bg-cyan-500/20"
        >
          <FileText class="h-4 w-4" />
          <span>View llms.txt</span>
          <ExternalLink class="h-3.5 w-3.5 opacity-70" />
        </a>

        <a
          href="/llms-full.txt"
          target="_blank"
          class="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2 font-mono text-xs font-semibold text-zinc-300 transition hover:bg-white/10 hover:text-white"
        >
          <Bot class="h-4 w-4" />
          <span>Full Text Docs (/llms-full.txt)</span>
        </a>

        <a
          href="/docs/ai-rules"
          class="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2 font-mono text-xs font-semibold text-zinc-300 transition hover:bg-white/10 hover:text-white"
        >
          <span>Read AI Rules Guide</span>
          <ArrowRight class="h-4 w-4" />
        </a>
      </div>
    </div>
  </div>

  <!-- Agent Installation Tabs -->
  <div class="mt-12 space-y-6">
    <div>
      <h2 class="font-mono text-xl font-bold tracking-tight text-white sm:text-2xl">
        Install into Your AI Coding Agent
      </h2>
      <p class="mt-1 text-sm text-zinc-400">
        Choose your agent to install the official rules and context.
      </p>
    </div>

    <!-- Tabs Header -->
    <div class="flex flex-wrap gap-2 border-b border-white/10 pb-3">
      {#each (['skills', 'claude', 'cursor', 'windsurf', 'antigravity'] as AgentTab[]) as tab}
        <button
          type="button"
          onclick={() => (activeTab = tab)}
          class={`flex items-center gap-2 rounded-lg px-4 py-2 font-mono text-xs transition ${
            activeTab === tab
              ? 'bg-cyan-500/10 font-bold text-cyan-300 border border-cyan-500/30'
              : 'text-zinc-400 hover:bg-white/5 hover:text-white border border-transparent'
          }`}
        >
          <span>{AGENT_CONFIGS[tab].name}</span>
        </button>
      {/each}
    </div>

    <!-- Active Tab Content -->
    <div class="rounded-xl border border-white/10 bg-zinc-900/60 p-6">
      <div class="flex flex-col gap-4">
        <div>
          <h3 class="font-mono text-sm font-bold text-white">{AGENT_CONFIGS[activeTab].name} Setup</h3>
          <p class="mt-1 text-xs text-zinc-400">{AGENT_CONFIGS[activeTab].desc}</p>
        </div>

        <!-- Terminal Command Box -->
        <div class="flex items-center justify-between rounded-lg border border-white/10 bg-zinc-950 p-3.5 font-mono text-xs">
          <div class="flex items-center gap-2.5 truncate">
            <Terminal class="h-4 w-4 shrink-0 text-cyan-400" />
            <code class="truncate text-zinc-200">{AGENT_CONFIGS[activeTab].command}</code>
          </div>
          <button
            type="button"
            onclick={() => copyToClipboard(AGENT_CONFIGS[activeTab].command)}
            class="flex items-center gap-1.5 rounded bg-white/5 px-2.5 py-1 text-zinc-400 transition hover:bg-white/10 hover:text-white"
          >
            {#if copiedCommand === AGENT_CONFIGS[activeTab].command}
              <Check class="h-3.5 w-3.5 text-emerald-400" />
              <span class="text-emerald-400">Copied</span>
            {:else}
              <Copy class="h-3.5 w-3.5" />
              <span>Copy</span>
            {/if}
          </button>
        </div>

        {#if AGENT_CONFIGS[activeTab].snippet}
          <div class="mt-2 space-y-1.5">
            <div class="font-mono text-[11px] uppercase tracking-wider text-zinc-500">
              Or add to {AGENT_CONFIGS[activeTab].filename}:
            </div>
            <CodeBlock code={AGENT_CONFIGS[activeTab].snippet || ''} lang="markdown" filename={AGENT_CONFIGS[activeTab].filename} />
          </div>
        {/if}
      </div>
    </div>
  </div>

  <!-- The 5 Golden Rules for LLMs -->
  <div class="mt-16 space-y-6">
    <div>
      <h2 class="font-mono text-xl font-bold tracking-tight text-white sm:text-2xl">
        The 5 Golden Rules for LLMs
      </h2>
      <p class="mt-1 text-sm text-zinc-400">
        Anti-hallucination guardrails every AI coding agent must enforce when writing Automata code.
      </p>
    </div>

    <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {#each GOLDEN_RULES as item}
        <div class="flex flex-col justify-between rounded-xl border border-white/10 bg-zinc-900/40 p-6">
          <div class="space-y-3">
            <div class="flex items-center gap-2.5">
              <span class="flex h-6 w-6 items-center justify-center rounded-full bg-cyan-500/20 font-mono text-xs font-bold text-cyan-300">
                {item.num}
              </span>
              <h3 class="font-mono text-sm font-bold text-white">{item.title}</h3>
            </div>

            <p class="text-xs font-medium text-cyan-400/90">{item.tagline}</p>
            <p class="text-xs text-zinc-300 leading-relaxed">{item.rule}</p>
          </div>

          <div class="mt-4 space-y-2 pt-2 border-t border-white/5 font-mono text-[11px]">
            <div class="rounded bg-emerald-950/40 border border-emerald-500/20 p-2.5 text-emerald-300">
              <div class="text-[10px] uppercase font-bold text-emerald-400 mb-0.5">✓ DO</div>
              <code>{item.correct}</code>
            </div>
            <div class="rounded bg-rose-950/40 border border-rose-500/20 p-2.5 text-rose-300">
              <div class="text-[10px] uppercase font-bold text-rose-400 mb-0.5">✗ DON'T</div>
              <code>{item.wrong}</code>
            </div>
          </div>
        </div>
      {/each}
    </div>
  </div>

  <!-- Interactive Prompt Templates -->
  <div class="mt-16 space-y-6">
    <div>
      <h2 class="font-mono text-xl font-bold tracking-tight text-white sm:text-2xl">
        Copyable Prompt Templates
      </h2>
      <p class="mt-1 text-sm text-zinc-400">
        Tested prompt patterns that yield clean, working, zero-eval Automata code on the first attempt.
      </p>
    </div>

    <div class="grid grid-cols-1 gap-6 md:grid-cols-3">
      {#each PROMPT_TEMPLATES as t}
        <div class="flex flex-col justify-between rounded-xl border border-white/10 bg-zinc-900/50 p-6">
          <div class="space-y-2">
            <h3 class="font-mono text-sm font-bold text-white">{t.title}</h3>
            <p class="text-xs text-zinc-400 leading-relaxed">{t.desc}</p>
            <div class="mt-3 rounded-lg border border-white/5 bg-zinc-950 p-3 font-mono text-[11px] text-zinc-300 whitespace-pre-line leading-relaxed">
              {t.prompt}
            </div>
          </div>

          <button
            type="button"
            onclick={() => copyToClipboard(t.prompt)}
            class="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 py-2 font-mono text-xs font-semibold text-zinc-300 transition hover:bg-white/10 hover:text-white"
          >
            {#if copiedCommand === t.prompt}
              <Check class="h-3.5 w-3.5 text-emerald-400" />
              <span class="text-emerald-400">Copied Prompt</span>
            {:else}
              <Copy class="h-3.5 w-3.5" />
              <span>Copy Prompt</span>
            {/if}
          </button>
        </div>
      {/each}
    </div>
  </div>
</div>
