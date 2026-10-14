<script lang="ts">
  import {
    ArrowRight,
    CheckCircle2,
    Cpu,
    ExternalLink,
    Eye,
    Gamepad2,
    Layers,
    Play,
    ShieldCheck,
    Sparkles,
    Terminal,
    Zap,
  } from 'lucide-svelte'
  import BentoCard from '$lib/components/BentoCard.svelte'
  import BentoGrid from '$lib/components/BentoGrid.svelte'
  import CodeBlock from '$lib/components/CodeBlock.svelte'
  import TerminalBox from '$lib/components/TerminalBox.svelte'

  const SPARTAN_CODE = `import { createSim, defineComponent, definePlugin, step } from '@mcthaydt/automata-sim'
import { createPixiRenderer } from '@mcthaydt/automata-render-pixi'
import { runApp } from '@mcthaydt/automata-runtime'

// 1. Pure, deterministic ECS components
const Position = defineComponent('pos', { x: 'f64', y: 'f64' })
const Velocity = defineComponent('vel', { vx: 'f64', vy: 'f64' })

// 2. Deterministic motion system (no Effect in the sim)
const movementPlugin = definePlugin({
  name: 'movement',
  update: ({ store }) => {
    store.query([Position, Velocity]).forEach(([pos, vel]) => {
      pos.x += vel.vx
      pos.y += vel.vy
    })
  }
})

// 3. Boot with PixiJS 2D renderer and Effect runtime boundaries
export const game = runApp({
  sim: createSim({ plugins: [movementPlugin] }),
  renderer: createPixiRenderer({ resolution: 'pixel-perfect' }),
  viewport: { width: 480, height: 270 }
})`
</script>

<div class="relative overflow-hidden">
  <!-- Ambient Top Gradient -->
  <div
    class="pointer-events-none absolute left-1/2 top-0 -z-10 h-[500px] w-full max-w-7xl -translate-x-1/2 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(56,189,248,0.12),transparent_70%)]"
  ></div>

  <!-- Hero Section -->
  <section class="mx-auto max-w-7xl px-4 pt-16 pb-20 sm:px-6 lg:px-8 lg:pt-24">
    <div class="flex flex-col items-center text-center">
      <!-- Announcement Pill -->
      <a
        href="/examples"
        class="inline-flex items-center gap-2 rounded-full border border-white/10 bg-zinc-900/80 px-3.5 py-1 text-xs font-medium text-zinc-300 shadow-lg backdrop-blur transition hover:border-white/20 hover:text-white"
      >
        <span class="flex h-2 w-2 rounded-full bg-cyan-400"></span>
        <span>M1 & M2 Foundation Live: 2D Renderer, Base-2D & Deterministic Core</span>
        <ArrowRight class="h-3 w-3 text-zinc-500" />
      </a>

      <!-- Headline -->
      <h1 class="mt-8 max-w-4xl font-mono text-4xl font-extrabold tracking-tight text-white sm:text-6xl sm:leading-none">
        The deterministic game framework <span class="text-zinc-400">for the web & Ruken.</span>
      </h1>

      <!-- Subtitle -->
      <p class="mt-6 max-w-2xl text-base text-zinc-400 sm:text-lg sm:leading-relaxed">
        Pure synchronous ECS simulation, PixiJS 2D & 3D rendering, and Effect runtime boundaries. Zero eval, bit-identical cross-browser replays, mobile-first from day one.
      </p>

      <!-- Action Row -->
      <div class="mt-10 flex flex-wrap items-center justify-center gap-4">
        <a
          href="/examples"
          class="inline-flex items-center gap-2 rounded-lg bg-cyan-400 px-5 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-cyan-300 shadow-lg shadow-cyan-500/20"
        >
          <Play class="h-4 w-4 fill-current" />
          <span>Explore Examples</span>
        </a>
        <a
          href="/cheatsheet"
          class="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-zinc-900 px-5 py-3 text-sm font-medium text-zinc-200 transition hover:bg-zinc-800 hover:text-white"
        >
          <Terminal class="h-4 w-4 text-zinc-400" />
          <span>API Cheatsheet</span>
        </a>
        <TerminalBox command="npx automata create-game my-game" />
      </div>

      <!-- Live Interactive Hero Canvas Frame -->
      <div class="relative mt-16 w-full max-w-5xl overflow-hidden rounded-2xl border border-white/10 bg-zinc-950 shadow-2xl">
        <div class="flex items-center justify-between border-b border-white/10 bg-zinc-900/60 px-4 py-2.5 text-xs font-mono text-zinc-400">
          <div class="flex items-center gap-2">
            <span class="h-3 w-3 rounded-full bg-red-500/80"></span>
            <span class="h-3 w-3 rounded-full bg-yellow-500/80"></span>
            <span class="h-3 w-3 rounded-full bg-green-500/80"></span>
            <span class="ml-2 font-medium text-zinc-300">automata — emberwick base-2d (60 fps)</span>
          </div>
          <div class="flex items-center gap-3">
            <span class="rounded bg-cyan-500/10 px-2 py-0.5 text-cyan-400">WebGL2 / Endesga 64</span>
            <a href="/examples?demo=base-2d" class="flex items-center gap-1 text-zinc-400 transition hover:text-white">
              <span>Full demo</span>
              <ExternalLink class="h-3 w-3" />
            </a>
          </div>
        </div>

        <div class="relative aspect-video w-full bg-zinc-900 flex flex-col items-center justify-center p-8 text-center">
          <div class="max-w-md space-y-4">
            <div class="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-500/20 bg-cyan-500/10 text-cyan-400">
              <Gamepad2 class="h-7 w-7" />
            </div>
            <h3 class="font-mono text-xl font-bold text-white">Interactive 2D Base Experience</h3>
            <p class="text-sm text-zinc-400 leading-relaxed">
              Explore Emberwick: fixed 60Hz physics, sub-tick sprite interpolation, and Endesga 64 palette lighting running right in the gallery.
            </p>
            <div class="pt-2">
              <a
                href="/examples?demo=base-2d"
                class="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-zinc-800 px-4 py-2 text-xs font-mono font-medium text-white transition hover:bg-zinc-700 hover:border-white/20"
              >
                <span>Launch in Examples Runner</span>
                <ArrowRight class="h-3.5 w-3.5" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- Bento Grid: Architecture Pillars -->
  <section class="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 border-t border-white/5">
    <div class="mb-12 text-center">
      <h2 class="font-mono text-xs font-semibold uppercase tracking-widest text-cyan-400">Architecture</h2>
      <p class="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">
        Built for Spartan Programmers
      </p>
      <p class="mt-3 max-w-2xl mx-auto text-sm text-zinc-400">
        No heavy GUI editors, no proprietary binary blobs, no runtime eval. Pure code, complete determinism, and rock-solid boundaries.
      </p>
    </div>

    <BentoGrid>
      <!-- Pillar 1: Determinism -->
      <BentoCard
        title="Pure Determinism"
        subtitle="Fixed 60Hz timestep, Koota ECS, xoshiro128** RNG, and bit-identical cross-engine replayability in Chromium, WebKit, and Firefox."
        badge="Sim Core"
        class="md:col-span-2"
      >
        {#snippet icon()}
          <Cpu class="h-5 w-5" />
        {/snippet}
        <div class="rounded-lg border border-white/5 bg-zinc-950 p-4 font-mono text-xs text-zinc-400">
          <div class="flex items-center justify-between text-zinc-500 pb-2 border-b border-white/5">
            <span>Deterministic Golden Hash Gate</span>
            <span class="text-emerald-400">● 100% Match</span>
          </div>
          <div class="mt-2 grid grid-cols-3 gap-2 text-center text-[11px]">
            <div class="rounded bg-zinc-900/60 p-2 border border-white/5">Chromium<br/><span class="text-white font-bold">54bfb33a</span></div>
            <div class="rounded bg-zinc-900/60 p-2 border border-white/5">WebKit<br/><span class="text-white font-bold">54bfb33a</span></div>
            <div class="rounded bg-zinc-900/60 p-2 border border-white/5">Firefox<br/><span class="text-white font-bold">54bfb33a</span></div>
          </div>
        </div>
      </BentoCard>

      <!-- Pillar 2: Modern Rendering -->
      <BentoCard
        title="Modern Rendering"
        subtitle="PixiJS v8 2D and 3D, WebGL2 default with WebGPU fallback, sub-tick interpolation, integer pixel framebuffer, and no-eval filter shaders."
        badge="Render Pixi"
      >
        {#snippet icon()}
          <Eye class="h-5 w-5" />
        {/snippet}
        <ul class="space-y-1.5 text-xs text-zinc-400 font-mono">
          <li class="flex items-center gap-2"><CheckCircle2 class="h-3.5 w-3.5 text-cyan-400" /> WebGL2 Default + WebGPU</li>
          <li class="flex items-center gap-2"><CheckCircle2 class="h-3.5 w-3.5 text-cyan-400" /> RenderDelta Sub-Tick Resync</li>
          <li class="flex items-center gap-2"><CheckCircle2 class="h-3.5 w-3.5 text-cyan-400" /> Zero unsafe-eval CSP Safe</li>
        </ul>
      </BentoCard>

      <!-- Pillar 3: Effect Runtime Boundaries -->
      <BentoCard
        title="Effect Boundaries"
        subtitle="Effect powers everything outside the sim: structured concurrency, typed errors, scoped lifetimes, and zero untrapped crashes."
        badge="Runtime"
      >
        {#snippet icon()}
          <Zap class="h-5 w-5" />
        {/snippet}
        <ul class="space-y-1.5 text-xs text-zinc-400 font-mono">
          <li class="flex items-center gap-2"><CheckCircle2 class="h-3.5 w-3.5 text-emerald-400" /> Typed BootError Unions</li>
          <li class="flex items-center gap-2"><CheckCircle2 class="h-3.5 w-3.5 text-emerald-400" /> Scoped Resource Lifecycles</li>
          <li class="flex items-center gap-2"><CheckCircle2 class="h-3.5 w-3.5 text-emerald-400" /> Clean Restart Without Reload</li>
        </ul>
      </BentoCard>

      <!-- Pillar 4: Mobile-First UI -->
      <BentoCard
        title="Mobile-First UI"
        subtitle="Adaptive geometry owner, height tiers, safe area occlusion, touch/gamepad/keyboard parity, verified at 780×270 reference sizes."
        badge="Automata UI"
      >
        {#snippet icon()}
          <Layers class="h-5 w-5" />
        {/snippet}
        <ul class="space-y-1.5 text-xs text-zinc-400 font-mono">
          <li class="flex items-center gap-2"><CheckCircle2 class="h-3.5 w-3.5 text-amber-400" /> Visual Viewport Occlusion</li>
          <li class="flex items-center gap-2"><CheckCircle2 class="h-3.5 w-3.5 text-amber-400" /> 780×270 Compact Landscape</li>
          <li class="flex items-center gap-2"><CheckCircle2 class="h-3.5 w-3.5 text-amber-400" /> Renderer-free DOM Fixtures</li>
        </ul>
      </BentoCard>

      <!-- Pillar 5: Content Compiler -->
      <BentoCard
        title="Content Compiler"
        subtitle="Smol-TOML discovery, Zod schema validation, instant in-place hot reload, and deterministic snapshot content hashing."
        badge="Content"
      >
        {#snippet icon()}
          <ShieldCheck class="h-5 w-5" />
        {/snippet}
        <ul class="space-y-1.5 text-xs text-zinc-400 font-mono">
          <li class="flex items-center gap-2"><CheckCircle2 class="h-3.5 w-3.5 text-purple-400" /> Exact file:line:col Errors</li>
          <li class="flex items-center gap-2"><CheckCircle2 class="h-3.5 w-3.5 text-purple-400" /> Hot-Reload In Place</li>
          <li class="flex items-center gap-2"><CheckCircle2 class="h-3.5 w-3.5 text-purple-400" /> XXH64 Content Hashes</li>
        </ul>
      </BentoCard>
    </BentoGrid>
  </section>

  <!-- Spartan 50-Line Code Section -->
  <section class="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 border-t border-white/5">
    <div class="grid grid-cols-1 gap-12 lg:grid-cols-2 items-center">
      <div class="space-y-6">
        <h2 class="font-mono text-xs font-semibold uppercase tracking-widest text-cyan-400">Simplicity First</h2>
        <h3 class="text-3xl font-bold tracking-tight text-white sm:text-4xl">
          Everything you need.<br/>Nothing you don't.
        </h3>
        <p class="text-zinc-400 leading-relaxed text-sm">
          Automata avoids monolithic visual editors and opaque scene graphs. You write pure TypeScript: declare components, wire deterministic systems, and attach high-performance rendering.
        </p>
        <div class="space-y-3 font-mono text-xs text-zinc-300">
          <div class="flex items-start gap-3">
            <span class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-cyan-500/10 text-cyan-400 font-bold">1</span>
            <span>Declare deterministic components with integer and floating point fields.</span>
          </div>
          <div class="flex items-start gap-3">
            <span class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-cyan-500/10 text-cyan-400 font-bold">2</span>
            <span>Compose systems into modular plugins with explicit execution order.</span>
          </div>
          <div class="flex items-start gap-3">
            <span class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-cyan-500/10 text-cyan-400 font-bold">3</span>
            <span>Mount the PixiJS renderer with sub-tick interpolation and no-eval shaders.</span>
          </div>
        </div>
        <div class="pt-2">
          <a
            href="/docs"
            class="inline-flex items-center gap-2 text-sm font-semibold text-cyan-400 transition hover:text-cyan-300"
          >
            <span>Read the Spartan Architecture Guide</span>
            <ArrowRight class="h-4 w-4" />
          </a>
        </div>
      </div>

      <!-- Code Block -->
      <div>
        <CodeBlock code={SPARTAN_CODE} filename="game.ts" lang="typescript" />
      </div>
    </div>
  </section>

  <!-- Ready to Build CTA -->
  <section class="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8 border-t border-white/5 text-center">
    <div class="mx-auto max-w-2xl space-y-6">
      <h2 class="font-mono text-3xl font-bold tracking-tight text-white sm:text-4xl">
        Ready to enjoy videogames programming?
      </h2>
      <p class="text-zinc-400 text-sm leading-relaxed">
        Scaffold a complete game in seconds. No graphical editors, no bloatware—just clean, high-performance TypeScript.
      </p>
      <div class="flex flex-wrap items-center justify-center gap-4 pt-4">
        <TerminalBox command="npx automata create-game my-game" />
        <a
          href="/examples"
          class="inline-flex items-center gap-2 rounded-lg bg-zinc-800 px-5 py-3 text-sm font-medium text-white transition hover:bg-zinc-700"
        >
          <span>View All Demos</span>
          <ArrowRight class="h-4 w-4" />
        </a>
      </div>
    </div>
  </section>
</div>
