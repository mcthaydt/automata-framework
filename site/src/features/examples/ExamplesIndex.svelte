<script lang="ts">
// /examples: every example, grouped by what it teaches, each opening beside its code. A card is the example's plain
// title with its id small beneath; what the example shows in the framework's words is on its own page.
import PageMeta from '../../shared/components/PageMeta.svelte'
import { type ExampleGroup, moduleTitle } from '../../shared/framework/example-catalog'

let { data }: { data: { index: ExampleGroup[] } } = $props()
</script>
<PageMeta title="Examples" description="Small Automata games, one file each. Open one and change its code: the game beside it updates as you type." />
<div class="page-shell examples-index">
  <h1>Examples</h1>
  <p class="lead">Small games, one file each. Open one and change its code: the game beside it updates as you type.</p>
  {#each data.index as group}
    <section>
      <h2>{moduleTitle(group.module)}</h2>
      <ul>
        {#each group.examples as example}
          <li>
            <a href={'/examples/' + example.id}><span class="name">{example.title}</span><code class="id">{example.id}</code></a>
          </li>
        {/each}
      </ul>
    </section>
  {/each}
</div>
<style>
  /* The page's heading is the same size as Start's and Home's section heads, not the display size inner pages default to. */
  .examples-index > h1 { max-width: none; font-size: clamp(36px, 4vw, 56px); font-weight: 600; line-height: 1.05; letter-spacing: -0.035em; }
  .examples-index > section > h2 { font-size: var(--step-title); }
  ul { display: grid; gap: 1rem; margin: 1.5rem 0 0; padding: 0; list-style: none; grid-template-columns: repeat(auto-fill, minmax(min(100%, 20rem), 1fr)); }
  li { border: 1px solid var(--line-strong); border-radius: var(--edge-lg); background: var(--paper); }
  li a { display: flex; flex-direction: column; gap: .35rem; min-height: 44px; padding: 1.1rem 1.25rem; text-decoration: none; }
  li a:hover { background: var(--bg); border-radius: var(--edge-lg); }
  .name { font-weight: 600; overflow-wrap: anywhere; }
  .id { padding: 0; background: none; font-family: var(--font-mono); font-size: var(--step-micro); font-weight: 500; color: var(--muted); }
</style>
