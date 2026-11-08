<script lang="ts">
import { onMount } from 'svelte'
import PageMeta from '../../shared/components/PageMeta.svelte'
import type { ApiEntry, ApiPackage } from '../../shared/framework/api'
import { apiVersions } from '../../shared/framework/api-reference'

// One package's reference, short enough to scan on a phone (site visual audit H4): each entry point folded to a row
// of its own, so the folded rows are the page's jump list, and inside each one row per export: its name, kind and
// first sentence. Opening an export shows its whole doc comment and signature. Filtering opens every group with a match.
let { data }: { data: { version: string; pkg: ApiPackage } } = $props()
let query = $state('')
const words = $derived(query.toLowerCase().split(/\s+/).filter(Boolean))
const points = $derived(
  data.pkg.entryPoints
    .map((point) => ({
      ...point,
      id: 'ep-' + point.path.replace(/[^a-z0-9]+/gi, '-'),
      entries: point.entries.filter((e) =>
        words.every((w) => (e.name + ' ' + e.doc).toLowerCase().includes(w)),
      ),
    }))
    .filter((point) => point.entries.length),
)
const others = $derived(apiVersions().filter((v) => v !== data.version))

/** The doc comment's first sentence, for the folded row. */
function summary(entry: ApiEntry): string {
  const first = entry.doc.split(/\n\n/)[0]?.replace(/\s+/g, ' ').trim() ?? ''
  return /^.*?[.!?](?=\s|$)/.exec(first)?.[0] ?? first
}

// A link to `#name` (from the header's search) opens the folds around that export, then scrolls to it: a browser
// does not reliably open a closed <details> for a fragment by itself.
function openTarget() {
  const id = decodeURIComponent(location.hash.slice(1))
  const target = id ? document.getElementById(id) : null
  if (!target) return
  for (let fold = target.closest('details'); fold; fold = fold.parentElement?.closest('details') ?? null)
    fold.open = true
  target.scrollIntoView()
}
onMount(() => {
  openTarget()
  addEventListener('hashchange', openTarget)
  return () => removeEventListener('hashchange', openTarget)
})
</script>
<PageMeta title={data.pkg.name + ' ' + data.version} description={'Every export of ' + data.pkg.name + ' version ' + data.version + ', with its signature and doc comment.'} />
<div class="page-shell api-page">
  <p class="small"><a href="/api">All packages</a></p>
  <h1>{data.pkg.name}</h1>
  <p class="lead">Version {data.version}. Every export, from the published types. Open a group, then an export, to see its signature.</p>
  {#if others.length}<p class="small">Other versions: {#each others as v}<a href={'/api/' + v + '/' + data.pkg.slug}>{v}</a> {/each}</p>{/if}
  <label for="pkg-search">Filter this package</label>
  <input id="pkg-search" type="search" bind:value={query} placeholder="A name or a word" />
  {#each points as point (point.path)}
    <details class="api-group" id={point.id} open={words.length > 0 || points.length === 1}>
      <summary><h2><code>{point.path}</code></h2><span class="small">{point.entries.length} {point.entries.length === 1 ? 'export' : 'exports'}</span></summary>
      {#each point.entries as entry (entry.name)}
        <!-- The framework's doc comment and signature, unchanged: site-checks leaves their words to the framework (data-framework-copy). -->
        <details class="api-entry" id={entry.name} data-framework-copy>
          <summary><h3>{entry.name}</h3> <span class="small">{entry.kind}</span>{#if entry.doc}<span class="api-summary">{summary(entry)}</span>{/if}</summary>
          {#if entry.doc}<p>{entry.doc}</p>{/if}
          <!-- Plain wrapped text: a signature needs no scroll region of its own. -->
          <pre class="api-signature-wrapped"><code>{entry.signature}</code></pre>
        </details>
      {/each}
    </details>
  {/each}
  {#if !points.length}<p role="status">No export matches. Try another word.</p>{/if}
</div>
