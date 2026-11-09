<script lang="ts">
// /examples: every example, grouped as the examples folder groups them, each opening beside its code.
import InlineText from '../../shared/components/InlineText.svelte'
import PageMeta from '../../shared/components/PageMeta.svelte'
import { difficultyStars, type ExampleGroup } from '../../shared/framework/example-catalog'

let { data }: { data: { index: ExampleGroup[] } } = $props()
// The folders are named for the packages; a visitor sees what each group is about.
const GROUP_NAMES: Record<string, string> = {
  core: 'The basics',
  shapes: 'Shapes',
  textures: 'Pictures and sprites',
  render: 'How it is drawn',
  audio: 'Sound',
}
</script>
<PageMeta title="Examples" description="Small Automata examples, one file each. Open one and it runs beside its code." />
<div class="page-shell examples-index">
  <h1>Examples</h1><p class="lead">Change the code on the left. The game on the right updates as you type.</p>
  <details class="examples-how"><summary>For developers: how the preview runs</summary><p>Edit the code and the example runs again once you pause typing. Each run starts in a new preview frame and is shown only once it is running, so an edit that fails leaves the last working preview in place. A compile error is marked in the editor at its line and column and named under the preview; selecting it moves the cursor there. Restart runs the last code that compiled again, in a new frame, without reloading the page.</p><p>This is how the playground on this site works, not a description of a game’s own hot reload or restart.</p></details>
  {#each data.index as group}
    <section>
      <h2>{GROUP_NAMES[group.module] ?? group.module}</h2>
      <ul>
        {#each group.examples as example}
          <li>
            <a href={'/examples/' + example.id}><span>{example.title}</span><strong>{example.id}</strong></a>
            <p><InlineText text={example.shows} /></p>
            <p class="difficulty" aria-label={'Difficulty ' + example.difficulty + ' of 4'}>{difficultyStars(example.difficulty)}</p>
          </li>
        {/each}
      </ul>
    </section>
  {/each}
</div>
<style>
  .examples-how { margin-top: 1rem; }
  .examples-how summary { min-height: 44px; display: flex; align-items: center; cursor: pointer; }
  ul { display: grid; gap: 1rem; margin: 1.5rem 0 0; padding: 0; list-style: none; grid-template-columns: repeat(auto-fill, minmax(min(100%, 20rem), 1fr)); }
  li { padding: 1.25rem; border: 1px solid var(--line-strong); border-radius: var(--radius); background: var(--paper); }
  li a { display: flex; flex-direction: column; gap: .2rem; min-height: 44px; text-decoration: none; }
  li a strong { font-family: var(--font-mono); font-size: var(--step-small); font-weight: 500; color: var(--muted); }
  li a span { font-weight: 600; }
  li p { margin: .6rem 0 0; font-size: var(--step-small); color: var(--muted); overflow-wrap: anywhere; }
  .difficulty { letter-spacing: .1em; }
</style>
