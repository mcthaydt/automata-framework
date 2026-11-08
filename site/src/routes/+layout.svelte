<script lang="ts">
  import '@fontsource-variable/geist/wght.css'
  import '@fontsource-variable/geist-mono/wght.css'
  // Preload the one face every page renders first: Geist's latin subset, all weights in one variable file.
  // Vite fingerprints it to the same asset the @font-face rule loads, so the preload is never a second download.
  import geistLatin from '@fontsource-variable/geist/files/geist-latin-wght-normal.woff2?url'
  import '../app.css'
  import { SITE_ORIGIN } from '$lib/site.js'
  import { page } from '$app/stores'
  import Header from '$lib/components/Header.svelte'
  import Footer from '$lib/components/Footer.svelte'
  import CommandMenu from '$lib/components/CommandMenu.svelte'
  let { children }: { children?: import('svelte').Snippet } = $props()
  let isSearchOpen = $state(false)
  function keydown(event: KeyboardEvent) {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault(); isSearchOpen = !isSearchOpen
    }
  }

</script>
<svelte:window onkeydown={keydown} />
<svelte:head>
  <link rel="preload" as="font" type="font/woff2" crossorigin="anonymous" href={geistLatin} />
  <link rel="canonical" href={SITE_ORIGIN + $page.url.pathname} /><meta property="og:url" content={SITE_ORIGIN + $page.url.pathname} /><meta property="og:image" content={SITE_ORIGIN + '/social.png'} />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="Automata" />
  <meta property="og:image:alt" content="Automata. Games, in your hands." />
  <meta name="twitter:card" content="summary_large_image" />
</svelte:head>
<a class="skip-link" href="#main">Skip to content</a>
<Header pathname={$page.url.pathname} onOpenSearch={() => isSearchOpen = true} />
<main id="main" tabindex="-1">{@render children?.()}</main>
<Footer />
<CommandMenu isOpen={isSearchOpen} onClose={() => isSearchOpen = false} />
