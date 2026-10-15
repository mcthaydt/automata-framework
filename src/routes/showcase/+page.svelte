<script lang="ts">
  import PageMeta from '$lib/components/PageMeta.svelte'
  import DemoRunner from '$lib/components/DemoRunner.svelte'
  import { SHOWCASE_GAMES } from '../../data/showcase'
</script>
<PageMeta title="Starter and references" description="Play Emberwick, Automata’s 2D starter, and learn which reference projects informed the framework." />
<div class="page-shell showcase-page"><h1>Play. Then build.</h1><p class="lead">A working starter, and the projects behind the framework.</p>
  {#each SHOWCASE_GAMES as game}<section class="project-section"><div><h2>{game.title}</h2><p><strong>{game.relationship}</strong></p><p class="lead">{game.tagline}</p><p>{game.description}</p></div>{#if game.bundleUrl}<DemoRunner src={game.bundleUrl} title={game.title} /><a href="/examples?demo=base-2d">Explore the starter source</a>{/if}</section>{/each}
</div>
