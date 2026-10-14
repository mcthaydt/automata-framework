<script lang="ts">
  import type { Snippet } from 'svelte'

  interface Props {
    title: string
    subtitle?: string
    badge?: string
    class?: string
    children?: Snippet
    icon?: Snippet
  }

  let {
    title,
    subtitle = '',
    badge = '',
    class: className = '',
    children,
    icon,
  }: Props = $props()
</script>

<div
  class={`group relative flex flex-col justify-between overflow-hidden rounded-xl border border-white/10 bg-zinc-900/60 p-6 backdrop-blur transition-all duration-300 hover:border-white/20 hover:bg-zinc-900/90 hover:shadow-2xl hover:shadow-cyan-500/5 ${className}`}
>
  <!-- Background Glow Accent -->
  <div
    class="pointer-events-none absolute -right-20 -top-20 h-40 w-40 rounded-full bg-cyan-500/5 blur-3xl transition-opacity duration-500 group-hover:opacity-100"
  ></div>

  <!-- Header -->
  <div class="relative z-10 space-y-2">
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-3">
        {#if icon}
          <div class="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-zinc-800/80 text-cyan-400">
            {@render icon()}
          </div>
        {/if}
        <h3 class="font-mono text-base font-semibold tracking-tight text-white">{title}</h3>
      </div>
      {#if badge}
        <span class="rounded-full border border-white/10 bg-zinc-800/80 px-2.5 py-0.5 font-mono text-[11px] font-medium text-zinc-300">
          {badge}
        </span>
      {/if}
    </div>
    {#if subtitle}
      <p class="text-sm leading-relaxed text-zinc-400">{subtitle}</p>
    {/if}
  </div>

  <!-- Content / Body -->
  {#if children}
    <div class="relative z-10 mt-4">
      {@render children()}
    </div>
  {/if}
</div>
