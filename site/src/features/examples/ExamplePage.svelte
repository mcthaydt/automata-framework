<script lang="ts">
import type { Snippet } from 'svelte'
import InlineText from '../../shared/components/InlineText.svelte'
import PageMeta from '../../shared/components/PageMeta.svelte'
import { difficultyStars, type Example, type ExampleGroup } from '../../shared/framework/example-catalog'

// The page around one example. The playground is its own feature, so the route passes it in as `children`.
let { data, children }: { data: { example: Example; index: ExampleGroup[] }; children?: Snippet } = $props()
let example = $derived(data.example)
</script>
<PageMeta title={example.id + ': ' + example.title} description={example.shows.replaceAll('`', '')} />
<div class="page-shell example-page">
  <div class="examples-layout">
    <aside><nav class="demo-list" aria-label="Examples">
      {#each data.index as group}<p>{group.module}</p>{#each group.examples as item}<a href={'/examples/' + item.id} aria-current={item.id === example.id ? 'page' : undefined}>{item.title}</a>{/each}{/each}
    </nav></aside>
    <article>
      <h1><code>{example.id}</code> {example.title}</h1>
      <dl class="spec-list">
        <div><dt>Shows</dt><dd><InlineText text={example.shows} /></dd></div>
        <div><dt>Controls</dt><dd>{example.controls}</dd></div>
        <div><dt>Difficulty</dt><dd aria-label={'Difficulty ' + example.difficulty + ' of 4'}>{difficultyStars(example.difficulty)}</dd></div>
        <div><dt>Packages</dt><dd>{example.packages.join(', ')}</dd></div>
      </dl>
      {@render children?.()}
    </article>
  </div>
</div>
<style>
  h1 { font-size: var(--step-title); line-height: 1.1; }
  h1 code { display: block; margin-bottom: .4rem; font-size: var(--step-small); font-weight: 500; color: var(--muted); background: none; padding: 0; }
  .demo-list p { margin: 1rem 0 .25rem; font-size: var(--step-small); font-weight: 600; text-transform: capitalize; }
  .demo-list a { min-height: 44px; display: flex; align-items: center; }
  @media (max-width: 900px) { .examples-layout { grid-template-columns: minmax(0, 1fr); } aside { order: 1; } }
  /* A phone on its side (audit M3): the facts would fill the screen, so the running example comes first. */
  @media (orientation: landscape) and (max-height: 500px) {
    article { display: flex; flex-direction: column; }
    .spec-list { order: 1; }
  }
</style>
