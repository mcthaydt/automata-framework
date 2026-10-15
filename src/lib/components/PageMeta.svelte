<script lang="ts">
  let { title, description = 'Explore Automata, a TypeScript game framework for deterministic simulation and PixiJS presentation. Play examples and read the documentation.' }: { title: string; description?: string } = $props()
</script>
<svelte:head>
  <title>{title} | Automata</title>
  <meta property="og:title" content={title + ' | Automata'} />
  <meta name="twitter:title" content={title + ' | Automata'} />
  {#if description}<meta name="description" content={description} /><meta property="og:description" content={description} />{/if}
</svelte:head>
