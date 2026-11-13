<script lang="ts">
import type { Snippet } from 'svelte'
import InlineText from '../../shared/components/InlineText.svelte'
import PageMeta from '../../shared/components/PageMeta.svelte'
import PageShell from '../../shared/components/PageShell.svelte'
import {
  difficultyStars,
  type Example,
  type ExampleGroup,
  moduleTitle,
  type SceneExample,
} from '../../shared/framework/example-catalog'

// The page around one example. The playground is its own feature, so the route passes it in as `children`.
let {
  data,
  children,
}: { data: { example: Example | SceneExample; index: ExampleGroup[] }; children?: Snippet } = $props()
let example = $derived(data.example)
// A 3D example's page keeps only what it shows above the frame: what to press, its difficulty and its packages come
// under it (SceneFrame), so Play is as high on a phone as the words allow.
let scene = $derived('frameUrl' in example)
</script>
<PageMeta title={example.id + ': ' + example.title} description={example.shows.replaceAll('`', '')} />
<PageShell wide class="example-page">
  <div class="examples-layout">
    <aside><nav class="demo-list" aria-label="Examples">
      {#each data.index as group}<p>{moduleTitle(group.module)}</p>{#each group.examples as item}<a href={'/examples/' + item.id} aria-current={item.id === example.id ? 'page' : undefined}>{item.title}</a>{/each}{/each}
    </nav></aside>
    <article class:scene>
      <h1><code>{example.id}</code> {example.title}</h1>
      <dl class="spec-list">
        <div><dt>Shows</dt><dd><InlineText text={example.shows} /></dd></div>
        {#if !scene}
          <div><dt>Controls</dt><dd>{example.controls}</dd></div>
          <div><dt>Difficulty</dt><dd aria-label={'Difficulty ' + example.difficulty + ' of 4'}>{difficultyStars(example.difficulty)}</dd></div>
          <div><dt>Packages</dt><dd>{example.packages.join(', ')}</dd></div>
        {/if}
      </dl>
      {@render children?.()}
    </article>
  </div>
</PageShell>
<style>
  h1 { font-size: var(--step-title); line-height: 1.1; }
  h1 code { display: block; margin-bottom: .4rem; font-size: var(--step-small); font-weight: 500; color: var(--muted); background: none; padding: 0; }
  .demo-list p { margin: 1rem 0 .25rem; font-size: var(--step-small); font-weight: 600; }
  .demo-list a { min-height: 44px; display: flex; align-items: center; }
  @media (max-width: 900px) { .examples-layout { grid-template-columns: minmax(0, 1fr); } aside { order: 1; } }
  /* A phone on its side: the facts would fill the screen, so the running example (a 3D example's stage and its Play)
     comes first and the words follow. */
  @media (orientation: landscape) and (max-height: 500px) {
    article { display: flex; flex-direction: column; }
    .spec-list { order: 1; }
  }
</style>
