<script lang="ts">
  import DemoRunner from '$lib/components/DemoRunner.svelte'
  import SourceExplorer from '$lib/components/SourceExplorer.svelte'
  import type { ProjectSource } from '../../data/projects'
  import PageMeta from '$lib/components/PageMeta.svelte'
  import { demoPoster } from '$lib/previews'
  import { DEMO_CATEGORIES, getDemosCatalog } from '../../data/demos'
  let { data = {} }: { data?: { demo?: string; file?: string; project?: ProjectSource } } = $props()
  const demos = getDemosCatalog()
  let category = $state('All Examples')
  let filtered = $derived(category === 'All Examples' ? demos : demos.filter(d => d.category === category))
  let current = $derived(demos.find(d => d.slug === data.demo) ?? demos[0])
</script>
<PageMeta title="Examples gallery" description="Run Automata examples and read the source beside rendering, physics, UI, runtime and content demos." />
<div class="page-shell">
  <h1>Examples gallery</h1><p class="lead">Working parts. Runnable code.</p>
  <div class="filters" role="group" aria-label="Example categories">{#each DEMO_CATEGORIES as item}<button type="button" aria-pressed={category === item} onclick={() => category = item}>{item}</button>{/each}</div>
  <div class="examples-layout">
    <aside aria-label="Select a demo"><nav class="demo-list">{#each filtered as demo}<a href={'/examples?demo=' + demo.slug} aria-current={current?.slug === demo.slug ? 'page' : undefined}>{demo.title}</a>{/each}</nav>{#if !filtered.length}<p>No examples in this category.</p>{/if}</aside>
    {#if current}<article>
      <h2>{current.title}</h2><DemoRunner src={current.bundleUrl} title={current.title} autoStart={false} poster={demoPoster(current.slug)} posterAlt={current.title + ' running in Automata'} />
      <dl class="spec-list"><div><dt>Shows</dt><dd>{current.shows}</dd></div><div><dt>Controls</dt><dd>{current.controls}</dd></div><div><dt>Base</dt><dd>{current.base}</dd></div><div><dt>Packages</dt><dd>{current.packages.join(', ')}</dd></div></dl>
      {#if data.project}{#key current.slug + (data.file ?? '')}<SourceExplorer project={data.project} initialFile={data.file} />{/key}{/if}
    </article>{/if}
  </div>
</div>
