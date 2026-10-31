<script lang="ts">
  import CodeBlock from '$lib/components/CodeBlock.svelte'
  import PageMeta from '$lib/components/PageMeta.svelte'
  import { apiVersions } from '$lib/api-reference'
  import type { PageData } from './$types'
  let { data }: { data: PageData } = $props()
  let query = $state('')
  const words = $derived(query.toLowerCase().split(/\s+/).filter(Boolean))
  const points = $derived(
    data.pkg.entryPoints
      .map((point) => ({ ...point, entries: point.entries.filter((e) => words.every((w) => (e.name + ' ' + e.doc).toLowerCase().includes(w))) }))
      .filter((point) => point.entries.length),
  )
  const others = $derived(apiVersions().filter((v) => v !== data.version))
</script>
<PageMeta title={data.pkg.name + ' ' + data.version} description={'Every export of ' + data.pkg.name + ' version ' + data.version + ', with its signature and doc comment.'} />
<div class="page-shell api-page">
  <p class="small"><a href="/api">Complete API reference</a></p>
  <h1>{data.pkg.name}</h1>
  <p class="lead">Version {data.version}, generated from the published declarations at framework commit <code>{data.commit.slice(0, 7)}</code>.</p>
  {#if others.length}<p class="small">Other versions: {#each others as v}<a href={'/api/' + v + '/' + data.pkg.slug}>{v}</a> {/each}</p>{/if}
  <label for="pkg-search">Filter this package</label>
  <input id="pkg-search" type="search" bind:value={query} placeholder="Filter by name or description" />
  {#each points as point}
    <section aria-labelledby={'ep-' + point.path}>
      <h2 id={'ep-' + point.path}><code>{point.path}</code></h2>
      {#each point.entries as entry}
        <article class="api-entry" id={entry.name}>
          <h3>{entry.name} <span class="small">{entry.kind}</span></h3>
          {#if entry.doc}<p>{entry.doc}</p>{/if}
          <CodeBlock code={entry.signature} filename={entry.name + ' signature'} />
        </article>
      {/each}
    </section>
  {/each}
  {#if !points.length}<p role="status">No export matches. Try another word.</p>{/if}
</div>
