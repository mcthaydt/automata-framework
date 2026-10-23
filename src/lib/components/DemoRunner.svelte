<script lang="ts">
  import { onMount, untrack } from 'svelte'
  import { getDemosCatalog } from '../../data/demos'
  import { demoStatus } from '../utils/demo-status'
  import { previewSrcset } from '$lib/previews'
  let { src, title, autoStart = true, poster, posterAlt = title + ' preview', class: className = '' }: { src: string; title: string; autoStart?: boolean; poster?: string; posterAlt?: string; aspect?: string; class?: string } = $props()
  let container: HTMLDivElement
  let iframe: HTMLIFrameElement | undefined = $state()
  let active = $state(untrack(() => autoStart))
  let mounted = $state(false)
  let attempt = $state(0)
  let status = $state<'loading' | 'ready' | 'failed'>('loading')
  let fullscreenMessage = $state('')
  let allowed = $derived(src === '/demos/first-change/index.html' || getDemosCatalog().some(d => d.bundleUrl === src))
  // Prerendered /examples has no query selection. Create resource URLs only after hydration,
  // otherwise Svelte preserves the server's default iframe src for a different selected demo.
  onMount(() => { if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) active = false; mounted = true })
  $effect(() => {
    // A changed src or retry gets a fresh deadline. Cleanup prevents late results from previous frames.
    const source = src
    const retry = attempt
    if (!active || !iframe || !allowed) return
    status = 'loading'
    const poll = setInterval(() => {
      try {
        const doc = iframe?.contentDocument ?? null
        const next = demoStatus(doc)
        if (next !== 'loading') { status = next; clearInterval(poll); clearTimeout(deadline) }
      } catch { status = 'failed'; clearInterval(poll); clearTimeout(deadline) }
    }, 200)
    const deadline = setTimeout(() => { status = 'failed'; clearInterval(poll) }, 20000)
    return () => { clearInterval(poll); clearTimeout(deadline) }
  })
  // Some browsers neither grant nor refuse a fullscreen request (headless WebKit among them). Without a word from the
  // page the button would look dead, so after this long the page says fullscreen has not started; a late answer
  // clears the message.
  const FULLSCREEN_PATIENCE_MS = 1000
  async function fullscreen() {
    const impatient = setTimeout(() => { fullscreenMessage = 'Fullscreen did not start. Open the demo in a new tab.' }, FULLSCREEN_PATIENCE_MS)
    try {
      if (document.fullscreenElement) await document.exitFullscreen()
      else await container.requestFullscreen()
      fullscreenMessage = ''
    } catch { fullscreenMessage = 'Fullscreen is unavailable. Open the demo in a new tab.' }
    finally { clearTimeout(impatient) }
  }
</script>
<div bind:this={container} data-testid="demo-runner-container" data-ui class={`demo-runner ${className}`}>
  <div class="demo-toolbar">
    <strong><span class="led" data-state={active && mounted ? (status === 'ready' ? 'live' : status === 'loading' ? 'loading' : 'off') : 'off'} aria-hidden="true"></span>{title}</strong>
    <div class="control-row">
      <button type="button" aria-label="Restart demo" onclick={() => { attempt++; active = true }}>Restart</button>
      <button type="button" aria-label="Toggle fullscreen" onclick={fullscreen}>Fullscreen</button>
      {#if allowed}<a href={src} target="_blank" rel="noopener noreferrer">Open demo</a>{/if}
      <!-- While stopped, the viewport overlay owns the single "Play demo" control. -->
      {#if active}<button type="button" onclick={() => active = false}>Stop demo</button>{/if}
    </div>
  </div>
  <div class="demo-viewport">
    {#if active && allowed && mounted}
      {#key src + attempt}
        <iframe bind:this={iframe} {src} {title} allow="autoplay; fullscreen" sandbox="allow-scripts allow-same-origin"></iframe>
      {/key}
      {#if status === 'loading'}<div class="demo-status" role="status"><p>Starting the demo…</p></div>{/if}
      {#if status === 'failed'}<div class="demo-status"><p role="alert">This demo couldn't start. Try again or open it in a new tab.</p><button type="button" onclick={() => attempt++}>Retry</button></div>{/if}
    {:else}
      {#if poster && allowed}<picture><source type="image/webp" srcset={previewSrcset(poster)} sizes="(max-width: 700px) 100vw, 75vw" /><img class="demo-poster" src={poster} alt={posterAlt} width="1280" height="720" /></picture>{/if}
      <div class:has-poster={poster && allowed} class="demo-status"><p>{!allowed ? 'This demo is unavailable.' : active && !mounted ? 'Starting the demo…' : poster ? 'Play here. No setup needed.' : 'The demo is stopped. Play to start a fresh session.'}</p>{#if allowed && (!active || mounted)}<button class="button" type="button" onclick={() => active = true}>Play demo</button>{/if}</div>
    {/if}
  </div>
  {#if fullscreenMessage}<p class="small" role="status">{fullscreenMessage}</p>{/if}
  <noscript><p>JavaScript is required for the embedded controls. <a href={src}>Open the standalone demo</a>.</p></noscript>
</div>
