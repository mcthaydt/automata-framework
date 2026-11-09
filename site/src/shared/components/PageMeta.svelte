<script lang="ts">
// The page's title and description, for the tab, search results and link previews. Every page sets its own.
let {
  title,
  description = 'Make 2D games for the web: draw the levels, let your coding agent write the code, and put the game online.',
}: { title: string; description?: string } = $props()
</script>
<svelte:head>
  <title>{title} | Automata</title>
  <meta property="og:title" content={title + ' | Automata'} />
  <meta name="twitter:title" content={title + ' | Automata'} />
  {#if description}<meta name="description" content={description} /><meta property="og:description" content={description} />{/if}
</svelte:head>
