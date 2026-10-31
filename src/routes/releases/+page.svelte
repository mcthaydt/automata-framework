<script lang="ts">
  import InlineText from '$lib/components/InlineText.svelte'
  import PageMeta from '$lib/components/PageMeta.svelte'
  import { PUBLICATION } from '../../data/publication'
  import { RELEASES } from '../../data/releases'
</script>
<PageMeta title="Releases" description="What changed in each package version, from the framework's own changelogs." />
<div class="page-shell releases-page">
  <h1>Releases</h1>
  <p class="lead">What changed in each package version, as the framework's changesets record it.</p>
  {#if !PUBLICATION.npm}
    <p role="note">Nothing has been published to npmjs.org yet. These versions are the framework's own, built from the repository; this page will carry install commands when the first public release exists.</p>
  {/if}
  <p class="small">Read from the framework's package changelogs at commit <code>{RELEASES.commit.slice(0, 7)}</code>. Entries are the framework's words, unedited. <a href="/api">The API reference</a> is kept for each version.</p>
  {#each RELEASES.packages as pkg}
    <section aria-labelledby={'pkg-' + pkg.name}>
      <h2 id={'pkg-' + pkg.name}>{pkg.name}</h2>
      {#each pkg.versions as release}
        <h3>{release.version}</h3>
        {#each release.changes as group}
          <h4>{group.kind}</h4>
          <ul>{#each group.items as item}<li>{#each item.text.split('\n') as line}<InlineText text={line} /> {/each}{#if item.commit}<code class="small">{item.commit}</code>{/if}</li>{/each}</ul>
        {/each}
      {/each}
    </section>
  {/each}
</div>
