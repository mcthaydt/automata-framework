<script lang="ts">
// The page's title and description, for the tab, search results and link previews. Every page sets its own.
let {
  title,
  description = 'Finish the game your agent started. Automata has the saves, menus, touch controls and publishing built in, and editors you change the game with.',
}: { title: string; description?: string } = $props()
</script>
<svelte:head>
  <title>{title} | Automata</title>
  <meta property="og:title" content={title + ' | Automata'} />
  <meta name="twitter:title" content={title + ' | Automata'} />
  {#if description}<meta name="description" content={description} /><meta property="og:description" content={description} />{/if}
</svelte:head>
