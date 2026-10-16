<script lang="ts">
  let { onOpenSearch, pathname = '/' }: { onOpenSearch?: () => void; pathname?: string } = $props()
  const links = [['/start', 'Start'], ['/examples', 'Examples'], ['/showcase', 'Showcase'], ['/docs', 'Docs'], ['/ai', 'AI']]
  let mobile: HTMLDetailsElement
  const current = (href: string) => href === '/' ? pathname === '/' : pathname.startsWith(href)
</script>
<header class="site-header">
  <a class="brand" href="/" aria-label="Automata home">automata</a>
  <nav class="desktop-nav" aria-label="Main navigation">
    {#each links as [href, label]}<a {href} aria-current={current(href) ? 'page' : undefined}>{label}</a>{/each}
  </nav>
  <div class="header-actions">
    <button class="search-trigger" type="button" onclick={onOpenSearch} aria-label="Search documentation and API">Search</button>
    <details bind:this={mobile} class="mobile-nav">
      <summary>Menu</summary>
      <nav aria-label="Mobile navigation">
        {#each links as [href, label]}<a {href} aria-current={current(href) ? 'page' : undefined} onclick={() => mobile.open = false}>{label}</a>{/each}
      </nav>
    </details>
  </div>
</header>
