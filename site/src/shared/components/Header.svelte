<!--
  The site's header, from the approved Home mockup (v2): the logo, five links (Docs, Examples, Editor, Pricing,
  Changelog; Reference is in the footer and the search, since the GTM research says price is what a maker asks first), Search, GitHub once the repository is public, and Make a game. Below 760 px the links fold into Menu, an
  opaque sheet under the bar, and Make a game stays in view.
  Search shows its ⌘K hint only where there is a keyboard (a fine pointer), never on a touch screen.
-->
<script lang="ts">
import { REPOSITORY_PUBLIC, REPOSITORY_URL } from '../site.js'
import Icon from './Icon.svelte'

let { onOpenSearch, pathname = '/' }: { onOpenSearch?: () => void; pathname?: string } = $props()

const links = [
  ['/docs', 'Docs'],
  ['/examples', 'Examples'],
  ['/editor', 'Editor'],
  ['/app', 'Pricing'],
  ['/changelog', 'Changelog'],
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
      {#if REPOSITORY_PUBLIC}
        <a class="github" href={REPOSITORY_URL}><Icon name="github" size={16} />GitHub</a>
      {/if}
      <a class="start" href="/start" aria-current={current('/start') ? 'page' : undefined}>Make a game</a>
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
  /* The current page is marked by colour and an underline, not by weight, so nothing shifts between pages. */
  .links a[aria-current='page'],
  .menu nav a[aria-current='page'] {
    text-decoration: underline 2px;
    text-underline-offset: 8px;
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
  .github {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 44px;
    padding: 0 10px;
    color: var(--muted);
    font-size: 14px;
    text-decoration: none;
  }
  .github:hover {
    color: var(--ink);
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
    box-shadow: 0 24px 48px -24px rgb(0 0 0 / 0.6);
  }
  .menu nav a {
    justify-content: flex-start;
    min-height: 48px;
    padding: 0;
    border-bottom: 1px solid var(--line);
    color: var(--ink);
    font-size: 17px;
  }
  /* Five links, Search and the button need the width a tablet does not have: Search is its icon alone and the GitHub link
     (in the footer too) waits for a wide screen. */
  @media (max-width: 1023px) {
    .bar {
      gap: 16px;
    }
    .github,
    .search .word,
    .search kbd {
      display: none;
    }
    .search {
      width: 44px;
      padding: 0;
    }
  }
  @media (max-width: 760px) {
    /* Search is its icon alone here: the word and the key hint leave room for Get started and Menu. */
    .links,
    .github,
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
  /* The phone menu eases in when opened; closing is instant. */
  @media (prefers-reduced-motion: no-preference) {
    .menu[open] nav {
      animation: motion-rise var(--t-ui) var(--ease-out);
    }
  }
</style>
