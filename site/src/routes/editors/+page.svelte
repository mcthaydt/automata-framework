<script lang="ts">
import PageMeta from '$lib/components/PageMeta.svelte'
import { EDITORS, SUITE_SPEC } from '../../data/editors'

const groups = [
  { id: 'framework', title: 'In the framework' },
  { id: 'plus', title: 'In Automata Plus' },
] as const
</script>
<PageMeta title="Editors" description="The editor suite for Automata games: what each editor changes, where it lives and where it stands." />
<div class="page-shell editors-page">
  <h1>Editors</h1>
  <p class="lead">An editor changes your game’s content files, and the game reads the same files at build time.</p>
  <p role="note">None of these is released yet and there is no editor to open on this site. They are specified in <a href={SUITE_SPEC}>the editor suite spec</a> and being built. This page lists what each will edit; it is not a feature list of anything you can use today.</p>
  <h2>Cost</h2>
  <p>The editors are free on the web and desktop. Automata Plus is free. The only paid product is the editor suite as iOS and Android apps, bought once.</p>
  {#each groups as group}
    <section aria-labelledby={'group-' + group.id}>
      <h2 id={'group-' + group.id}>{group.title}</h2>
      <ul>
        {#each EDITORS.filter(e => e.home === group.id) as editor}
          <li><strong>{editor.name}</strong>: {editor.edits} <span class="small">(in development)</span></li>
        {/each}
      </ul>
    </section>
  {/each}
  <h2>How edits are made</h2>
  <p>Each editor writes only the files the game lists as editable, as a change set on a branch you can review and undo. <a href="/docs/plus">Automata Plus</a> says what lives outside the core framework.</p>
</div>
