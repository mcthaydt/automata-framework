<!--
  The site's header, from the approved Home mockup: the logo, four links (Docs, Examples, Editor, API), Search and
  Get started. Below 760 px the links fold into Menu, an opaque sheet under the bar, and Get started stays in view.
  Search shows its ⌘K hint only where there is a keyboard (a fine pointer), never on a touch screen.
-->
<script lang="ts">
let { onOpenSearch, pathname = '/' }: { onOpenSearch?: () => void; pathname?: string } = $props()

const links = [
  ['/docs', 'Docs'],
  ['/examples', 'Examples'],
  ['/editors', 'Editor'],
  ['/api', 'API'],
] as const

let menu: HTMLDetailsElement | undefined = $state()
const current = (href: string) => pathname === href || pathname.startsWith(href + '/')
</script>

<header class="site-header">
  <div class="bar">
    <a class="logo" href="/" aria-label="Automata home"><i aria-hidden="true"></i>automata</a>
    <nav class="links" aria-label="Main navigation">
      {#each links as [href, label] (href)}<a {href} aria-current={current(href) ? 'page' : undefined}>{label}</a>{/each}
    </nav>
    <div class="end">
      <button class="search" type="button" onclick={onOpenSearch} aria-label="Search the docs and the API">
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></svg>
        <span class="word">Search</span><kbd aria-hidden="true">⌘K</kbd>
      </button>
      <a class="start" href="/start" aria-current={current('/start') ? 'page' : undefined}>Get started</a>
      <details class="menu" bind:this={menu}>
        <summary aria-label="Menu">
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
        </summary>
        <nav aria-label="Mobile navigation">
          {#each links as [href, label] (href)}
            <a {href} aria-current={current(href) ? 'page' : undefined} onclick={() => menu && (menu.open = false)}>{label}</a>
          {/each}
        </nav>
      </details>
    </div>
  </div>
</header>

<style>
  .site-header {
    position: sticky;
    top: 0;
    z-index: 20;
    border-bottom: 1px solid var(--line);
    background: var(--bg);
  }
  .bar {
    display: flex;
    align-items: center;
    gap: 32px;
    width: min(var(--wrap), 100% - 2 * var(--side));
    height: 64px;
    margin: 0 auto;
  }
  .logo {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 44px;
    color: var(--ink);
    font-size: 18px;
    font-weight: 600;
    letter-spacing: -0.02em;
    text-decoration: none;
  }
  /* The mark: a lime square with an ink edge, the primary's colours. */
  .logo i {
    width: 10px;
    height: 10px;
    border: 1px solid var(--ink);
    border-radius: 2px;
    background: var(--lime);
  }
  .links {
    display: flex;
    gap: 8px;
  }
  .links a,
  .menu nav a {
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 44px;
    min-height: 44px;
    padding: 0 8px;
    color: var(--muted);
    font-size: 15px;
    text-decoration: none;
  }
  .links a:hover,
  .links a[aria-current='page'] {
    color: var(--ink);
  }
  .links a[aria-current='page'] {
    font-weight: 600;
  }
  .end {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-left: auto;
  }
  .search {
    gap: 8px;
    padding: 0 8px 0 12px;
    color: var(--muted);
    font-size: 14px;
  }
  .search svg,
  .menu svg {
    flex: none;
    fill: none;
    stroke: currentColor;
    stroke-width: 2;
    stroke-linecap: round;
  }
  kbd {
    padding: 2px 6px;
    border: 1px solid var(--line);
    border-radius: var(--edge-sm);
    background: var(--soft);
    font: 500 12px/16px var(--font-mono, monospace);
  }
  /* A touch screen has no ⌘K to press. */
  @media not ((hover: hover) and (pointer: fine)) {
    kbd {
      display: none;
    }
  }
  .start {
    display: inline-flex;
    align-items: center;
    min-height: 44px;
    padding: 0 18px;
    border: 1px solid var(--line-strong);
    border-radius: var(--edge-sm);
    background: var(--panel);
    color: var(--ink);
    font-size: 15px;
    font-weight: 500;
    text-decoration: none;
  }
  .start:hover {
    border-color: var(--ink);
  }
  .menu {
    display: none;
  }
  .menu summary {
    display: grid;
    place-items: center;
    width: 44px;
    height: 44px;
    margin-right: -10px;
    border-radius: var(--edge-sm);
    color: var(--ink);
    list-style: none;
    cursor: pointer;
  }
  .menu summary::-webkit-details-marker {
    display: none;
  }
  /* Opaque: nothing on the page shows through the open menu. */
  .menu nav {
    position: absolute;
    top: 64px;
    right: 0;
    left: 0;
    display: grid;
    padding: 8px var(--side) 16px;
    border-bottom: 1px solid var(--line);
    background: var(--bg);
    box-shadow: 0 24px 48px -24px rgb(17 21 28 / 0.25);
  }
  .menu nav a {
    justify-content: flex-start;
    min-height: 48px;
    padding: 0;
    border-bottom: 1px solid var(--line);
    color: var(--ink);
    font-size: 17px;
  }
  .menu nav a[aria-current='page'] {
    font-weight: 600;
  }
  @media (max-width: 760px) {
    /* Search is its icon alone here: the word and the key hint leave room for Get started and Menu. */
    .links,
    .search .word,
    .search kbd {
      display: none;
    }
    .search {
      width: 44px;
      padding: 0;
    }
    .menu {
      display: block;
    }
  }
</style>
