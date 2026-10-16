<script lang="ts">
  import PageMeta from '$lib/components/PageMeta.svelte'
  import CreativeStarts from '$lib/components/CreativeStarts.svelte'
  import { COMMUNITY_GAMES, SHOWCASE_GAMES, SHOWCASE_SUBMISSION_URL } from '../../data/showcase'
</script>
<PageMeta title="Made with Automata" description="Play and remix real Automata starters: a platformer, a double-jump change, and a physics playground. See reference projects and share your own game." />
<div class="page-shell showcase-page">
  <h1>Your next<br />game starts here.</h1><p class="lead">Play something. Change one thing. See where it takes you.</p>
  <section><h2>Play a starting point</h2><p>These are Automata starters and feature demos, with real code to build on. Pick the kind of game you want to make.</p><CreativeStarts /></section>
  <section class="community-showcase"><h2>Games from the community</h2>
    {#if COMMUNITY_GAMES.length}<div class="community-games">{#each COMMUNITY_GAMES as game}<article>{#if game.image}<img src={game.image} alt={game.title + ' gameplay'} loading="lazy" />{/if}<h3>{game.title}</h3><p>By {game.creator}</p><p>{game.description}</p><a href={game.url}>Play {game.title}</a></article>{/each}</div>
    {:else}<p>No community submissions have been published here yet.</p>{/if}
    <div class="showcase-submit"><div><h3>Share your game.</h3><p>Include a playable link, your creator name, the Automata version, a short description and screenshots you have permission to share. Submissions are reviewed before being added here.</p></div><a class="button" href={SHOWCASE_SUBMISSION_URL}>Submit your game</a></div>
  </section>
  <section class="reference-projects"><h2>Reference projects</h2><p>These projects informed the framework. They are distinct from reviewed games made with Automata.</p>{#each SHOWCASE_GAMES.filter(game => !game.bundleUrl) as game}<article><h3>{game.title}</h3><p>{game.relationship}</p><p>{game.description}</p></article>{/each}</section>
</div>
