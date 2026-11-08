<script lang="ts">
// The page's title and description, for the tab, search results and link previews. Every page sets its own.
let {
  title,
  description = 'Automata is an AI-first TypeScript game framework. Build with coding agents, verify their work, author the content and stay in control of the source.',
}: { title: string; description?: string } = $props()
</script>
<svelte:head>
  <title>{title} | Automata</title>
  <meta property="og:title" content={title + ' | Automata'} />
  <meta name="twitter:title" content={title + ' | Automata'} />
  {#if description}<meta name="description" content={description} /><meta property="og:description" content={description} />{/if}
</svelte:head>
