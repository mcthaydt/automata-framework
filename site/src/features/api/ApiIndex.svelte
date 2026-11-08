<script lang="ts">
// /api: the reference's front page, one link per published package for each version the site keeps.
import PageMeta from '../../shared/components/PageMeta.svelte'
import { apiVersions, getApiReference } from '../../shared/framework/api-reference'

const versions = apiVersions()
</script>
<PageMeta title="Complete API reference" description="Every export of every published Automata package, one page per package, for each published version." />
<div class="page-shell api-page">
  <h1>Complete API reference</h1>
  <p class="lead">Every export of every published package, generated from the published type declarations.</p>
  <p>An export that is not listed for a version does not exist in it. The same text as one file is <a href="/llms-api.txt">llms-api.txt</a>.</p>
  {#each versions as version}
    {@const reference = getApiReference(version)}
    {#if reference}
      <section aria-labelledby={'v-' + version}>
        <h2 id={'v-' + version}>Version {version}</h2>
        <ul>{#each reference.packages as pkg}<li><a href={'/api/' + version + '/' + pkg.slug}>{pkg.name}</a> <span class="small">({pkg.entryPoints.reduce((n, e) => n + e.entries.length, 0)} exports)</span></li>{/each}</ul>
      </section>
    {/if}
  {/each}
</div>
