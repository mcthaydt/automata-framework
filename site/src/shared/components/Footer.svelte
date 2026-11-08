<!--
  The site's footer: the logo, the licence and the pages a visitor looks for last. The contact address stays as it
  is until the Owner decides what it should be.
-->
<script lang="ts">
import { CONTACT_EMAIL } from '../site.js'

const links = [
  ['/docs', 'Docs'],
  ['/examples', 'Examples'],
  ['/api', 'Reference'],
  ['/app', 'The app'],
  ['/privacy', 'Privacy'],
  ['/terms', 'Terms'],
] as const
</script>

<footer class="site-footer">
  <div class="bar">
    <a class="logo" href="/" aria-label="Automata home"><i aria-hidden="true"></i>automata</a>
    <span>MIT licence</span>
    <nav aria-label="Footer navigation">
      {#each links as [href, label] (href)}<a {href}>{label}</a>{/each}
      <a href={'mailto:' + CONTACT_EMAIL}>Contact</a>
    </nav>
  </div>
</footer>

<style>
  .site-footer {
    border-top: 1px solid var(--line);
    padding: 24px 0 40px;
    color: var(--muted);
    font-size: 14px;
  }
  .bar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 16px;
    width: min(var(--wrap), 100% - 2 * var(--side));
    margin: 0 auto;
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
    border: 1px solid var(--ink);
    border-radius: 2px;
    background: var(--lime);
  }
  nav {
    display: flex;
    flex-wrap: wrap;
    margin-left: auto;
  }
  nav a {
    display: flex;
    align-items: center;
    min-height: 44px;
    padding: 0 8px;
    color: var(--muted);
    text-decoration: none;
  }
  nav a:hover {
    color: var(--ink);
  }
  @media (max-width: 760px) {
    nav {
      width: 100%;
      margin-left: -8px;
    }
  }
</style>
