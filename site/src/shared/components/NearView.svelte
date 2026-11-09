<!--
  Shows its content only once the reader is within 400 px of it. A browser's own `loading="lazy"` leaves that
  distance to its network guess: Chromium fetched Home's editor picture right after the poster, and Lighthouse charges
  every picture fetched before the first paint to the poster's LCP. Where there is no IntersectionObserver the content
  shows at once; without script the prerendered <noscript> copy shows. The caller sizes the box (an aspect-ratio), so
  the page does not move when the content arrives.
-->
<script lang="ts">
import type { Snippet } from 'svelte'

let { children }: { children: Snippet } = $props()
let box: HTMLElement | undefined = $state()
let near = $state(false)
$effect(() => {
  if (near || !box) return
  if (typeof IntersectionObserver === 'undefined') {
    near = true
    return
  }
  const observer = new IntersectionObserver(
    (entries) => {
      if (entries.some((entry) => entry.isIntersecting)) near = true
    },
    { rootMargin: '400px' },
  )
  observer.observe(box)
  return () => observer.disconnect()
})
</script>

<span bind:this={box} class="near-view">
  {#if near}{@render children()}{/if}
  <noscript>{@render children()}</noscript>
</span>

<style>
  .near-view {
    display: block;
  }
</style>
