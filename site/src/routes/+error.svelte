<script lang="ts">
import { page } from '$app/stores'
import NotFound from '../shared/components/NotFound.svelte'
import PageMeta from '../shared/components/PageMeta.svelte'
import PageShell from '../shared/components/PageShell.svelte'
</script>

{#if $page.status === 404}
  <NotFound />
{:else}
  <PageMeta title="Something went wrong" />
  <PageShell>
    <h1>Something went wrong.</h1>
    <p>Try reloading the page, or return to the overview.</p>
    <div class="link-row">
      <a class="button" href="/">Go to the home page</a>
      <a href="/docs">Read the docs</a>
    </div>
  </PageShell>
{/if}
