<script lang="ts">
// What a visitor sees at an address nothing answers: where to go instead. The build serves it as `404.html`
// (scripts/make-404.ts), and the router shows it for a missing address reached by a link.
import PageMeta from './PageMeta.svelte'
import PageShell from './PageShell.svelte'
</script>

<PageMeta title="Page not found" />
<PageShell>
  <h1>Lost your place?</h1>
  <p>That page is unavailable. The examples and documentation are a good place to start.</p>
  <div class="link-row">
    <a class="button" href="/">Back to overview</a>
    <a href="/docs">Read the docs</a>
    <a href="/examples">Explore examples</a>
  </div>
</PageShell>
