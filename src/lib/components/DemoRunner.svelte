<script lang="ts">
  import {
    AlertCircle,
    Check,
    ExternalLink,
    Maximize2,
    RefreshCw,
    RotateCcw,
  } from 'lucide-svelte'

  interface Props {
    src: string
    title: string
    aspect?: string
    class?: string
  }

  let {
    src,
    title,
    aspect = 'aspect-video',
    class: className = '',
  }: Props = $props()

  let containerEl: HTMLElement | undefined = $state()
  let iframeEl: HTMLIFrameElement | undefined = $state()
  let isLoading = $state(true)
  let hasError = $state(false)
  let isRestarting = $state(false)

  // Reset loading state when src changes
  $effect(() => {
    if (src) {
      isLoading = true
      hasError = false
    }
  })

  function handleRestart() {
    if (!iframeEl) return
    isRestarting = true
    isLoading = true
    hasError = false
    const currentSrc = iframeEl.src
    iframeEl.src = 'about:blank'
    setTimeout(() => {
      if (iframeEl) {
        iframeEl.src = currentSrc
        isRestarting = false
      }
    }, 100)
  }

  async function handleFullscreen() {
    if (!containerEl) return
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen()
      } else {
        await containerEl.requestFullscreen()
      }
    } catch (_e) {
      // Fullscreen not supported or blocked
    }
  }

  function handleOpenTab() {
    window.open(src, '_blank')
  }

  function onLoad() {
    isLoading = false
    hasError = false
  }

  function onError() {
    isLoading = false
    hasError = true
  }
</script>

<div
  bind:this={containerEl}
  data-testid="demo-runner-container"
  class={`relative flex flex-col overflow-hidden rounded-xl border border-white/10 bg-zinc-950 shadow-2xl ${className}`}
>
  <!-- Top Control Header Bar -->
  <div class="flex items-center justify-between border-b border-white/10 bg-zinc-900/80 px-4 py-2.5 text-xs font-mono backdrop-blur">
    <div class="flex items-center gap-2">
      <span class="inline-block h-2.5 w-2.5 rounded-full bg-cyan-400"></span>
      <span class="font-medium text-white truncate max-w-[200px] sm:max-w-md">{title}</span>
    </div>

    <!-- Action Buttons -->
    <div class="flex items-center gap-1.5 text-zinc-400">
      <button
        type="button"
        onclick={handleRestart}
        aria-label="Restart demo"
        title="Restart demo"
        class="inline-flex h-7 w-7 items-center justify-center rounded border border-white/5 bg-zinc-800/60 transition hover:bg-zinc-700 hover:text-white"
      >
        <RotateCcw class={`h-3.5 w-3.5 ${isRestarting ? 'animate-spin text-cyan-400' : ''}`} />
      </button>

      <button
        type="button"
        onclick={handleFullscreen}
        aria-label="Toggle fullscreen"
        title="Toggle fullscreen"
        class="inline-flex h-7 w-7 items-center justify-center rounded border border-white/5 bg-zinc-800/60 transition hover:bg-zinc-700 hover:text-white"
      >
        <Maximize2 class="h-3.5 w-3.5" />
      </button>

      <button
        type="button"
        onclick={handleOpenTab}
        aria-label="Open in new window"
        title="Open in new window"
        class="inline-flex h-7 w-7 items-center justify-center rounded border border-white/5 bg-zinc-800/60 transition hover:bg-zinc-700 hover:text-white"
      >
        <ExternalLink class="h-3.5 w-3.5" />
      </button>
    </div>
  </div>

  <!-- Player Canvas Container -->
  <div class={`relative w-full ${aspect} bg-zinc-950 flex items-center justify-center`}>
    <!-- Sandboxed Iframe Player -->
    <iframe
      bind:this={iframeEl}
      {src}
      {title}
      onload={onLoad}
      onerror={onError}
      allow="autoplay; fullscreen"
      sandbox="allow-scripts allow-same-origin"
      class="h-full w-full border-0 bg-transparent"
    ></iframe>

    <!-- Loading Spinner Overlay -->
    {#if isLoading && !hasError}
      <div class="pointer-events-none absolute inset-0 flex flex-col items-center justify-center bg-zinc-950/80 backdrop-blur-sm space-y-2">
        <RefreshCw class="h-6 w-6 animate-spin text-cyan-400" />
        <span class="font-mono text-xs text-zinc-400">Loading interactive sandbox...</span>
      </div>
    {/if}

    <!-- Graceful Error Fallback Overlay (Review Focus 1) -->
    {#if hasError}
      <div class="absolute inset-0 flex flex-col items-center justify-center bg-zinc-950/95 p-6 text-center space-y-3">
        <div class="flex h-10 w-10 items-center justify-center rounded-full bg-red-500/10 text-red-400 border border-red-500/20">
          <AlertCircle class="h-5 w-5" />
        </div>
        <div class="space-y-1">
          <h4 class="font-mono text-sm font-bold text-white">Demo Bundle Unavailable</h4>
          <p class="max-w-xs text-xs text-zinc-400">
            The compiled sandbox could not be loaded. Please ensure demo bundles are compiled.
          </p>
        </div>
        <button
          type="button"
          onclick={handleRestart}
          class="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-zinc-800 px-3 py-1.5 font-mono text-xs text-white transition hover:bg-zinc-700"
        >
          <RotateCcw class="h-3 w-3" />
          <span>Retry</span>
        </button>
      </div>
    {/if}
  </div>
</div>
