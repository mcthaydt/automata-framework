<script lang="ts">
// What a visitor sees at an address nothing answers: where to go instead. The build serves it as `404.html`
// (scripts/make-404.ts), and the router shows it for a missing address reached by a link.
import PageMeta from './PageMeta.svelte'
import PageShell from './PageShell.svelte'
</script>

<PageMeta title="Page not found" />
<!-- The 404 page answers every missing address, so it must never be a search result of its own. -->
<svelte:head><meta name="robots" content="noindex" /></svelte:head>
<PageShell>
  <h1>Page not found</h1>
  <p>There is no page at this address. It may have moved.</p>
  <div class="link-row">
    <a class="button" href="/">Go to the home page</a>
    <a href="/docs">Read the docs</a>
  </div>
</PageShell>
