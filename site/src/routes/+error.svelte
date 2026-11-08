<script lang="ts">
import { page } from '$app/stores'
import PageMeta from '../shared/components/PageMeta.svelte'
import PageShell from '../shared/components/PageShell.svelte'
</script>
<PageMeta title={$page.status === 404 ? 'Page not found' : 'Something went wrong'} />
<PageShell><h1>{$page.status === 404 ? 'Lost your place?' : 'Something went wrong.'}</h1><p>{$page.status === 404 ? 'That page is unavailable. The examples and documentation are a good place to start.' : 'Try reloading the page, or return to the overview.'}</p><div class="link-row"><a class="button" href="/">Back to overview</a><a href="/docs">Read the docs</a><a href="/examples">Explore examples</a></div></PageShell>
