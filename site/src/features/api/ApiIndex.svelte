<script lang="ts">
// /api: the reference's front page, one link per published package for each version the site keeps.
import PageMeta from '../../shared/components/PageMeta.svelte'
import PageShell from '../../shared/components/PageShell.svelte'
import './api.css'
import { apiVersions, getApiReference, groupPackages } from '../../shared/framework/api-reference'

const versions = apiVersions()
</script>
<PageMeta title="Complete API reference" description="Every export of every published Automata package, one page per package, for each published version." />
<PageShell class="api-page">
  <h1>Complete API reference</h1>
  <p class="lead">Every export of every published package, generated from the published type declarations.</p>
  <p>An export that is not listed for a version does not exist in it. The same text as one file is <a href="/llms-api.txt">llms-api.txt</a>.</p>
  {#each versions as version}
    {@const reference = getApiReference(version)}
    {#if reference}
      {@const groups = groupPackages(reference)}
      <section aria-labelledby={'v-' + version}>
        <h2 id={'v-' + version}>Version {version}</h2>
        {#each [['Core', groups.core], ['Extensions', groups.extensions]] as const as [name, packages] (name)}
          {#if packages.length > 0}
            <h3>{name}</h3>
            <ul>{#each packages as pkg (pkg.slug)}<li><a href={'/api/' + version + '/' + pkg.slug}>{pkg.name}</a> <span class="small">({pkg.entryPoints.reduce((n, e) => n + e.entries.length, 0)} exports)</span></li>{/each}</ul>
          {/if}
        {/each}
      </section>
    {/if}
  {/each}
</PageShell>
