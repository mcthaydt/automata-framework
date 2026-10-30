<script lang="ts">
  import PageMeta from '$lib/components/PageMeta.svelte'
  import InlineText from '$lib/components/InlineText.svelte'
  import { difficultyStars, type ExampleGroup } from '../../data/examples'
  let { data }: { data: { index: ExampleGroup[] } } = $props()
</script>
<PageMeta title="Examples" description="Small Automata examples, one file each. Open one and it runs beside its code." />
<div class="page-shell examples-index">
  <h1>Examples</h1><p class="lead">One file each. Open an example and it runs beside its code.</p>
  {#each data.index as group}
    <section>
      <h2>{group.module}</h2>
      <ul>
        {#each group.examples as example}
          <li>
            <a href={'/examples/' + example.id}><strong>{example.id}</strong><span>{example.title}</span></a>
            <p><InlineText text={example.shows} /></p>
            <p class="difficulty" aria-label={'Difficulty ' + example.difficulty + ' of 4'}>{difficultyStars(example.difficulty)}</p>
          </li>
        {/each}
      </ul>
    </section>
  {/each}
</div>
<style>
  .examples-index h2 { text-transform: capitalize; }
  ul { display: grid; gap: 1rem; margin: 1.5rem 0 0; padding: 0; list-style: none; grid-template-columns: repeat(auto-fill, minmax(min(100%, 20rem), 1fr)); }
  li { padding: 1.25rem; border: 1px solid var(--line-strong); border-radius: var(--radius); background: var(--paper); }
  li a { display: flex; flex-direction: column; gap: .2rem; min-height: 44px; text-decoration: none; }
  li a strong { font-family: var(--font-mono); font-size: var(--step-small); font-weight: 500; color: var(--muted); }
  li a span { font-weight: 600; }
  li p { margin: .6rem 0 0; font-size: var(--step-small); color: var(--muted); overflow-wrap: anywhere; }
  .difficulty { letter-spacing: .1em; }
</style>
