<!--
  The site's footer, from the approved Home mockup (v2): the logo and the licence, then three short columns. GitHub
  appears only once the repository is public. The contact address stays as it is until the Owner decides what it
  should be.
-->
<script lang="ts">
import { CONTACT_EMAIL, REPOSITORY_PUBLIC, REPOSITORY_URL } from '../site.js'

const columns = [
  {
    title: 'Build',
    links: [
      ['/docs', 'Docs'],
      ['/examples', 'Examples'],
      ['/api', 'Reference'],
    ],
  },
  {
    title: 'Tools',
    links: [
      ['/editor', 'Level editor'],
      ['/app', 'The app'],
      ['/changelog', 'Changelog'],
      ...(REPOSITORY_PUBLIC ? [[REPOSITORY_URL, 'GitHub']] : []),
    ],
  },
  {
    title: 'About',
    links: [
      ['/privacy', 'Privacy'],
      ['/terms', 'Terms'],
      ['/credits', 'Credits'],
      ['mailto:' + CONTACT_EMAIL, 'Contact'],
    ],
  },
] as const
</script>

<footer class="site-footer">
  <div class="bar">
    <div class="brand">
      <a class="logo" href="/" aria-label="Automata home"><i aria-hidden="true"></i>automata</a>
      <p>MIT licence. Made for browser games.</p>
    </div>
    <nav aria-label="Footer navigation">
      {#each columns as column (column.title)}
        <div class="column">
          <h2>{column.title}</h2>
          {#each column.links as [href, label] (href)}<a {href}>{label}</a>{/each}
        </div>
      {/each}
    </nav>
  </div>
</footer>

<style>
  .site-footer {
    border-top: 1px solid var(--line);
    padding: 40px 0 56px;
    color: var(--muted);
    font-size: 14px;
  }
  .bar {
    display: grid;
    grid-template-columns: 2fr 3fr;
    gap: 24px;
    width: min(var(--wrap), 100% - 2 * var(--side));
    margin: 0 auto;
  }
  .brand p {
    margin: 12px 0 0;
    color: var(--faint);
    font-size: 13px;
  }
  .logo {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 44px;
    color: var(--ink);
    font-size: 16px;
    font-weight: 600;
    letter-spacing: -0.02em;
    text-decoration: none;
  }
  .logo i {
    width: 9px;
    height: 9px;
    border-radius: 2px;
    background: var(--lime);
  }
  nav {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 24px;
  }
  .column h2 {
    margin: 0 0 4px;
    color: var(--ink);
    font-size: 13px;
    font-weight: 600;
    line-height: 20px;
    letter-spacing: 0;
  }
  nav a {
    display: flex;
    align-items: center;
    min-height: 44px;
    color: var(--muted);
    text-decoration: none;
  }
  nav a:hover {
    color: var(--ink);
  }
  @media (max-width: 760px) {
    .bar {
      grid-template-columns: 1fr;
    }
    nav {
      grid-template-columns: 1fr 1fr;
    }
  }
</style>
