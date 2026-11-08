<script lang="ts">
import InlineText from '$lib/components/InlineText.svelte'
import PageMeta from '$lib/components/PageMeta.svelte'
import type { HighlightedLine } from '$lib/playground/highlight'
import Playground from '$lib/playground/Playground.svelte'
import { difficultyStars, type Example, type ExampleGroup } from '../../../data/examples'

let { data }: { data: { example: Example; highlighted: HighlightedLine[]; index: ExampleGroup[] } } = $props()
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
      {#key example.id}<Playground {example} highlighted={data.highlighted} />{/key}
    </article>
  </div>
</div>
<style>
  h1 { font-size: var(--step-title); line-height: 1.1; }
  h1 code { display: block; margin-bottom: .4rem; font-size: var(--step-small); font-weight: 500; color: var(--muted); background: none; padding: 0; }
  .demo-list p { margin: 1rem 0 .25rem; font-size: var(--step-small); font-weight: 600; text-transform: capitalize; }
  .demo-list a { min-height: 44px; display: flex; align-items: center; }
  @media (max-width: 900px) { .examples-layout { grid-template-columns: minmax(0, 1fr); } aside { order: 1; } }
</style>
