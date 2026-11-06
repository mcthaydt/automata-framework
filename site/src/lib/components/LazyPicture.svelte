<script lang="ts">
  import { previewSrcset } from '$lib/previews'
  // `src` is the preview's JPEG path, as `previewSrcset` takes it. `aspect` is the CSS aspect-ratio of the box the
  // picture fills, so the page does not move when the picture arrives.
  let { src, alt, width, height, aspect, sizes }: { src: string; alt: string; width: number; height: number; aspect: string; sizes: string } = $props()
  let box: HTMLElement | undefined = $state()
  let near = $state(false)
  // The picture is not in the page until the reader is within 400 px of it: the browser's own `loading="lazy"` leaves
  // that distance to its network guess, and Chromium 153 fetched pictures 2,000 px away right after the poster. Where
  // there is no IntersectionObserver the picture shows at once.
  $effect(() => {
    if (near || !box) return
    if (typeof IntersectionObserver === 'undefined') { near = true; return }
    const observer = new IntersectionObserver(entries => { if (entries.some(entry => entry.isIntersecting)) near = true }, { rootMargin: '400px' })
    observer.observe(box)
    return () => observer.disconnect()
  })
</script>
<span bind:this={box} class="lazy-picture" style={`aspect-ratio: ${aspect}`}>
  {#if near}<picture><source type="image/webp" srcset={previewSrcset(src)} {sizes} /><img {src} {alt} {width} {height} /></picture>{/if}
  <!-- The prerendered page has no picture of its own, so a reader without script gets this copy. -->
  <noscript><picture><source type="image/webp" srcset={previewSrcset(src)} {sizes} /><img {src} {alt} {width} {height} loading="lazy" /></picture></noscript>
</span>
