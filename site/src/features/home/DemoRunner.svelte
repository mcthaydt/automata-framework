<script lang="ts">
// Home's game: the poster edge to edge with one bar under it. "Play it" mounts the built game from /demos/ in the
// poster's place; playing, the bar offers Full screen and Stop. Stopping drops the frame, so a stopped demo costs
// nothing. A press on Play it made before the page was hydrated is kept by the page's first-press script
// (`data-play-pressed`, shared/html/hydration.ts) and starts the game as soon as this mounts.
import { onMount } from 'svelte'
import { previewSrcset } from '../../shared/previews'
import './demo-runner.css'
import { demoStatus } from './demo-status'
import { getDemosCatalog } from './demos'
import type { DemoBar } from './home-content'

let {
  src,
  start,
  poster,
  posterAlt,
  bar,
}: {
  src: string
  /** The screen the game opens on, when the visitor has already pressed Play it (the game reads `?start=`). */
  start?: string
  poster: string
  posterAlt: string
  bar: DemoBar
} = $props()
let container: HTMLDivElement
let iframe: HTMLIFrameElement | undefined = $state()
let active = $state(false)
let mounted = $state(false)
let attempt = $state(0)
let status = $state<'loading' | 'ready' | 'failed'>('loading')
let fullscreenMessage = $state('')
let fullscreenPending = $state(false)
let isFullscreen = $state(false)
let fullscreenWord = $derived(isFullscreen ? bar.exitFullScreen : bar.fullScreen)
let allowed = $derived(getDemosCatalog().some((d) => d.bundleUrl === src))
let frameSrc = $derived(start === undefined ? src : `${src}?start=${encodeURIComponent(start)}`)
// The frame's address is made after hydration, so the prerendered page never carries a stale one.
onMount(() => {
  if (document.documentElement.dataset.playPressed !== undefined) {
    delete document.documentElement.dataset.playPressed
    active = true
  }
  // From here the button answers its own press, so the page's first-press script stops marking.
  document.documentElement.dataset.playMounted = ''
  mounted = true
  // The button says what pressing it does: leave full screen while the demo is in it.
  const follow = () => (isFullscreen = document.fullscreenElement === container)
  document.addEventListener('fullscreenchange', follow)
  return () => document.removeEventListener('fullscreenchange', follow)
})
$effect(() => {
  // A changed src or retry gets a fresh deadline. Cleanup prevents late results from previous frames.
  void src
  void attempt
  if (!active || !iframe || !allowed) return
  status = 'loading'
  const poll = setInterval(() => {
    try {
      const doc = iframe?.contentDocument ?? null
      const next = demoStatus(doc)
      if (next !== 'loading') {
        status = next
        // The visitor pressed a button in this page, so the keys would go to it: hand them to the game. Focusing the frame also scrolls it into view, which the game needs: a frame out of view pauses.
        if (next === 'ready') iframe?.contentWindow?.focus()
        clearInterval(poll)
        clearTimeout(deadline)
      }
    } catch {
      status = 'failed'
      clearInterval(poll)
      clearTimeout(deadline)
    }
  }, 200)
  const deadline = setTimeout(() => {
    status = 'failed'
    clearInterval(poll)
  }, 20000)
  return () => {
    clearInterval(poll)
    clearTimeout(deadline)
  }
})
// Some browsers neither grant nor refuse a fullscreen request (headless WebKit among them). Without a word from the
// page the button would look dead, so after this long the page says fullscreen has not started; a late answer
// clears the message.
const FULLSCREEN_PATIENCE_MS = 1000
// The browser's answer can be slow too, on a loaded machine with a demo running. The click itself therefore marks the
// button busy (aria-busy) until the browser has answered or the page has given up waiting.
async function fullscreen() {
  fullscreenPending = true
  const impatient = setTimeout(() => {
    fullscreenPending = false
    fullscreenMessage = bar.fullScreenSlow
  }, FULLSCREEN_PATIENCE_MS)
  try {
    if (document.fullscreenElement) await document.exitFullscreen()
    else await container.requestFullscreen()
    fullscreenMessage = ''
  } catch {
    fullscreenMessage = bar.noFullScreen
  } finally {
    clearTimeout(impatient)
    fullscreenPending = false
  }
}
let playing = $derived(active && allowed && mounted)
</script>
<div bind:this={container} data-testid="demo-runner-container" data-ui class="demo-runner">
  <div class="demo-bar">
    <div class="demo-words">
      <strong>{bar.title}</strong>
      {#if playing && status === 'failed'}<span role="alert">{bar.failed}</span>
      {:else if fullscreenMessage}<span role="status">{fullscreenMessage}</span>
      {:else if playing && status === 'loading'}<span role="status">{bar.starting}</span>
      {:else}<span class="tagline">{bar.tagline}</span>{/if}
    </div>
    <span class="demo-keys" role="group" aria-label={`${bar.keys.join(', ')} ${bar.keysWords}`}>
      {#each bar.keys as key (key)}<kbd aria-hidden="true">{key}</kbd>{/each}<span aria-hidden="true">{bar.keysWords}</span>
    </span>
    <div class="demo-actions">
      {#if playing && status === 'failed'}
        <button type="button" onclick={() => attempt++}>{bar.retry}</button>
      {:else if playing}
        <button type="button" aria-busy={fullscreenPending ? 'true' : undefined} onclick={fullscreen}>{fullscreenWord}</button>
        <button type="button" onclick={() => (active = false)}>{bar.stop}</button>
      {:else}
        <button type="button" data-play onclick={() => (active = true)}>{bar.play}</button>
      {/if}
    </div>
  </div>
  <div class="demo-viewport" data-playing={playing ? '' : undefined}>
    {#if playing}
      {#key src + attempt}
        <iframe bind:this={iframe} src={frameSrc} title={bar.title} allow="autoplay; fullscreen"></iframe>
      {/key}
    {:else if allowed}
      <picture><source type="image/webp" srcset={previewSrcset(poster)} sizes="(max-width: 700px) 100vw, 1080px" /><img class="demo-poster" src={poster} alt={posterAlt} width="1280" height="720" /></picture>
    {/if}
  </div>
  <noscript><p class="small">Playing here needs JavaScript. <a href={src}>Open the game on its own page</a>.</p></noscript>
</div>
